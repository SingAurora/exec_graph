// Package network contains the MySQL read model for public execution networks.
package network

import (
	"context"
	"time"

	applicationnetwork "github.com/singaurora/exec-graph/backend/internal/application/network"
	"gorm.io/gorm"
)

type Repository struct{ orm *gorm.DB }

func NewRepository(orm *gorm.DB) Repository { return Repository{orm: orm} }

func (repository Repository) Load(ctx context.Context, currentUserID *uint64) (applicationnetwork.Graph, error) {
	graph := applicationnetwork.Graph{
		Nodes: make([]applicationnetwork.Node, 0),
		Edges: make([]applicationnetwork.Edge, 0),
	}
	nodeIndex := map[string]int{}
	projectNodes := map[string]string{}
	personNodes := map[uint64]string{}
	recordNodes := map[string]string{}
	ensurePerson := func(id uint64, name, handle string) string {
		if nodeID, exists := personNodes[id]; exists {
			return nodeID
		}
		nodeID := "person:" + handle
		personNodes[id] = nodeID
		nodeIndex[nodeID] = len(graph.Nodes)
		graph.Nodes = append(graph.Nodes, applicationnetwork.Node{
			ID: nodeID, Kind: "person", Label: name, Detail: "@" + handle, UserID: handle,
			IsCurrentUser: currentUserID != nil && id == *currentUserID,
		})
		return nodeID
	}
	ensureRecord := func(uuid, projectID, title, summary string) string {
		if nodeID, exists := recordNodes[uuid]; exists {
			return nodeID
		}
		nodeID := "record:" + uuid
		recordNodes[uuid] = nodeID
		nodeIndex[nodeID] = len(graph.Nodes)
		graph.Nodes = append(graph.Nodes, applicationnetwork.Node{
			ID: nodeID, Kind: "record", Label: title, Detail: summary, ProjectID: projectID, RecordID: uuid,
		})
		return nodeID
	}
	addEdge := func(edge applicationnetwork.Edge) {
		if _, sourceExists := nodeIndex[edge.Source]; !sourceExists {
			return
		}
		if _, targetExists := nodeIndex[edge.Target]; !targetExists {
			return
		}
		graph.Edges = append(graph.Edges, edge)
	}

	rows, err := repository.orm.WithContext(ctx).Raw(`
		SELECT p.uuid, p.title, p.description, u.id, u.username, u.user_id,
		       EXISTS(SELECT 1 FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY p.created_at ASC`).Rows()
	if err != nil {
		return applicationnetwork.Graph{}, err
	}
	for rows.Next() {
		var projectID, title, detail, ownerName, ownerHandle string
		var ownerID uint64
		var hasOpenCall bool
		if err := rows.Scan(&projectID, &title, &detail, &ownerID, &ownerName, &ownerHandle, &hasOpenCall); err != nil {
			rows.Close()
			return applicationnetwork.Graph{}, err
		}
		nodeID := "project:" + projectID
		projectNodes[projectID] = nodeID
		nodeIndex[nodeID] = len(graph.Nodes)
		graph.Nodes = append(graph.Nodes, applicationnetwork.Node{ID: nodeID, Kind: "project", Label: title, Detail: detail, ProjectID: projectID, HasOpenCall: hasOpenCall})
		addEdge(applicationnetwork.Edge{ID: "maintains:" + projectID, Source: ensurePerson(ownerID, ownerName, ownerHandle), Target: nodeID, Type: "maintains", Label: "维护"})
	}
	if err := rows.Err(); err != nil {
		return applicationnetwork.Graph{}, err
	}
	if err := rows.Close(); err != nil {
		return applicationnetwork.Graph{}, err
	}

	rows, err = repository.orm.WithContext(ctx).Raw(`
		SELECT r.uuid, p.uuid, r.title, r.summary, r.created_at,
		       n.actor_id, u.username, u.user_id
		FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		JOIN users u ON u.id = n.actor_id
		WHERE r.record_kind = 'accepted'
		  AND p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY r.created_at ASC`).Rows()
	if err != nil {
		return applicationnetwork.Graph{}, err
	}
	for rows.Next() {
		var recordID, projectID, title, summary, authorName, authorHandle string
		var createdAt time.Time
		var authorID uint64
		if err := rows.Scan(&recordID, &projectID, &title, &summary, &createdAt, &authorID, &authorName, &authorHandle); err != nil {
			rows.Close()
			return applicationnetwork.Graph{}, err
		}
		recordNodeID := ensureRecord(recordID, projectID, title, summary)
		authorNodeID := ensurePerson(authorID, authorName, authorHandle)
		addEdge(applicationnetwork.Edge{ID: "record-author:" + recordID, Source: authorNodeID, Target: recordNodeID, Type: "authored", Label: "形成成果", RecordID: recordID, SourceProjectID: projectID, CreatedAt: createdAt})
		addEdge(applicationnetwork.Edge{ID: "record-project:" + recordID, Source: recordNodeID, Target: projectNodes[projectID], Type: "result", Label: "形成于", RecordID: recordID, SourceProjectID: projectID, CreatedAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		return applicationnetwork.Graph{}, err
	}
	if err := rows.Close(); err != nil {
		return applicationnetwork.Graph{}, err
	}

	rows, err = repository.orm.WithContext(ctx).Raw(`
		SELECT s.uuid, s.status, s.created_at, r.uuid, c.uuid,
		       s.mapping_text, COALESCE(s.note, ''), r.title, r.summary,
		       source_project.uuid, source_project.title, target_project.uuid, target_project.title
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = s.call_id
		JOIN projects target_project ON target_project.id = c.project_id
		WHERE s.status IN ('submitted', 'adopted')
		  AND source_project.visibility = 'public' AND source_project.archived_at IS NULL
		  AND target_project.visibility = 'public' AND target_project.archived_at IS NULL
		ORDER BY s.created_at ASC`).Rows()
	if err != nil {
		return applicationnetwork.Graph{}, err
	}
	for rows.Next() {
		var submissionID, status, recordID, callID, mappingText, note, recordTitle, recordSummary string
		var sourceProjectID, sourceProjectTitle, targetProjectID, targetProjectTitle string
		var createdAt time.Time
		if err := rows.Scan(&submissionID, &status, &createdAt, &recordID, &callID, &mappingText, &note, &recordTitle, &recordSummary, &sourceProjectID, &sourceProjectTitle, &targetProjectID, &targetProjectTitle); err != nil {
			rows.Close()
			return applicationnetwork.Graph{}, err
		}
		edgeType, edgeLabel := "contributing", "正在贡献"
		if status == "adopted" {
			edgeType, edgeLabel = "adopted", "正式采纳"
		}
		edge := applicationnetwork.Edge{RecordID: recordID, CallID: callID, Type: edgeType, Label: edgeLabel, Detail: mappingText, SourceProjectID: sourceProjectID, TargetProjectID: targetProjectID, SourceProjectTitle: sourceProjectTitle, TargetProjectTitle: targetProjectTitle, CreatedAt: createdAt}
		edge.ID, edge.Source, edge.Target = "project-submission:"+submissionID, projectNodes[sourceProjectID], projectNodes[targetProjectID]
		addEdge(edge)
		recordNodeID := ensureRecord(recordID, sourceProjectID, recordTitle, recordSummary)
		edge.ID, edge.Source, edge.Target = "record-submission:"+submissionID, recordNodeID, projectNodes[targetProjectID]
		if note != "" {
			edge.Detail += "\n\n补充说明：" + note
		}
		addEdge(edge)
	}
	if err := rows.Err(); err != nil {
		return applicationnetwork.Graph{}, err
	}
	if err := rows.Close(); err != nil {
		return applicationnetwork.Graph{}, err
	}

	rows, err = repository.orm.WithContext(ctx).Raw(`
		SELECT p.uuid, target_project.uuid, c.uuid, p.created_at
		FROM projects p
		JOIN collaboration_calls c ON c.id = p.contribution_call_id
		JOIN projects target_project ON target_project.id = c.project_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		  AND c.status = 'open'`).Rows()
	if err != nil {
		return applicationnetwork.Graph{}, err
	}
	for rows.Next() {
		var sourceProjectID, targetProjectID, callID string
		var createdAt time.Time
		if err := rows.Scan(&sourceProjectID, &targetProjectID, &callID, &createdAt); err != nil {
			rows.Close()
			return applicationnetwork.Graph{}, err
		}
		addEdge(applicationnetwork.Edge{ID: "workspace:" + sourceProjectID, Source: projectNodes[sourceProjectID], Target: projectNodes[targetProjectID], Type: "workspace", Label: "贡献工作区", CallID: callID, CreatedAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		return applicationnetwork.Graph{}, err
	}
	if err := rows.Close(); err != nil {
		return applicationnetwork.Graph{}, err
	}

	weights := map[string]int{}
	for _, edge := range graph.Edges {
		weights[edge.Source]++
		weights[edge.Target]++
	}
	for index := range graph.Nodes {
		graph.Nodes[index].Weight = weights[graph.Nodes[index].ID]
	}
	return graph, nil
}
