package app

import (
	"context"
	"net/http"
	"time"

	sharedconstants "github.com/singaurora/exec-graph/backend/internal/shared/constants"
)

type publicNetworkNodeResponse struct {
	ID            string `json:"id"`
	Kind          string `json:"kind"`
	Label         string `json:"label"`
	Detail        string `json:"detail"`
	ProjectID     string `json:"projectId,omitempty"`
	RecordID      string `json:"recordId,omitempty"`
	UserID        string `json:"userId,omitempty"`
	Weight        int    `json:"weight"`
	HasOpenCall   bool   `json:"hasOpenCall"`
	IsCurrentUser bool   `json:"isCurrentUser"`
}

type publicNetworkEdgeResponse struct {
	ID                 string    `json:"id"`
	Source             string    `json:"source"`
	Target             string    `json:"target"`
	Type               string    `json:"type"`
	Label              string    `json:"label"`
	Detail             string    `json:"detail,omitempty"`
	RecordID           string    `json:"recordId,omitempty"`
	CallID             string    `json:"callId,omitempty"`
	SourceProjectID    string    `json:"sourceProjectId,omitempty"`
	TargetProjectID    string    `json:"targetProjectId,omitempty"`
	SourceProjectTitle string    `json:"sourceProjectTitle,omitempty"`
	TargetProjectTitle string    `json:"targetProjectTitle,omitempty"`
	CreatedAt          time.Time `json:"createdAt"`
}

type publicNetworkResponse struct {
	Nodes []publicNetworkNodeResponse `json:"nodes"`
	Edges []publicNetworkEdgeResponse `json:"edges"`
}

// handleExploreNetwork projects real public collaboration facts into a public,
// read-only graph. It intentionally never fabricates co-worker relationships.
func (s *server) handleExploreNetwork(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	user, authenticated := s.optionalUser(r)
	ctx, cancel := context.WithTimeout(r.Context(), sharedconstants.DatabaseOperationTimeout)
	defer cancel()

	network := publicNetworkResponse{Nodes: make([]publicNetworkNodeResponse, 0), Edges: make([]publicNetworkEdgeResponse, 0)}
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
		nodeIndex[nodeID] = len(network.Nodes)
		network.Nodes = append(network.Nodes, publicNetworkNodeResponse{ID: nodeID, Kind: "person", Label: name, Detail: "@" + handle, UserID: handle, IsCurrentUser: authenticated && id == user.ID})
		return nodeID
	}
	ensureRecord := func(id, projectID, title, summary string) string {
		if nodeID, exists := recordNodes[id]; exists {
			return nodeID
		}
		nodeID := "record:" + id
		recordNodes[id] = nodeID
		nodeIndex[nodeID] = len(network.Nodes)
		network.Nodes = append(network.Nodes, publicNetworkNodeResponse{ID: nodeID, Kind: "record", Label: title, Detail: summary, ProjectID: projectID, RecordID: id})
		return nodeID
	}
	addEdge := func(edge publicNetworkEdgeResponse) {
		if _, sourceExists := nodeIndex[edge.Source]; !sourceExists {
			return
		}
		if _, targetExists := nodeIndex[edge.Target]; !targetExists {
			return
		}
		network.Edges = append(network.Edges, edge)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT p.id, p.title, p.description, u.id, u.username, u.user_id,
		       EXISTS(SELECT 1 FROM collaboration_calls c WHERE c.project_id = p.id AND c.status = 'open')
		FROM projects p JOIN users u ON u.id = p.owner_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY p.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取执行网络失败")
		return
	}
	for rows.Next() {
		var projectID, title, detail, ownerName, ownerHandle string
		var ownerID uint64
		var hasOpenCall bool
		if err := rows.Scan(&projectID, &title, &detail, &ownerID, &ownerName, &ownerHandle, &hasOpenCall); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "读取执行网络失败")
			return
		}
		nodeID := "project:" + projectID
		projectNodes[projectID] = nodeID
		nodeIndex[nodeID] = len(network.Nodes)
		network.Nodes = append(network.Nodes, publicNetworkNodeResponse{ID: nodeID, Kind: "project", Label: title, Detail: detail, ProjectID: projectID, HasOpenCall: hasOpenCall})
		ownerNodeID := ensurePerson(ownerID, ownerName, ownerHandle)
		addEdge(publicNetworkEdgeResponse{ID: "maintains:" + projectID, Source: ownerNodeID, Target: nodeID, Type: "maintains", Label: "维护"})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		writeError(w, http.StatusInternalServerError, "读取执行网络失败")
		return
	}
	rows.Close()

	rows, err = s.db.QueryContext(ctx, `
		SELECT r.id, r.project_id, r.title, r.summary, r.created_at,
		       n.actor_id, u.username, u.user_id
		FROM completion_records r
		JOIN projects p ON p.id = r.project_id
		JOIN execution_contracts n ON n.id = r.closing_contract_id
		JOIN users u ON u.id = n.actor_id
		WHERE r.record_kind = 'accepted'
		  AND p.visibility = 'public' AND p.archived_at IS NULL
		ORDER BY r.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取公开成果失败")
		return
	}
	for rows.Next() {
		var recordID, projectID, title, summary, authorName, authorHandle string
		var createdAt time.Time
		var authorID uint64
		if err := rows.Scan(&recordID, &projectID, &title, &summary, &createdAt, &authorID, &authorName, &authorHandle); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "读取公开成果失败")
			return
		}
		recordNodeID := ensureRecord(recordID, projectID, title, summary)
		authorNodeID := ensurePerson(authorID, authorName, authorHandle)
		addEdge(publicNetworkEdgeResponse{ID: "record-author:" + recordID, Source: authorNodeID, Target: recordNodeID, Type: "authored", Label: "形成成果", RecordID: recordID, SourceProjectID: projectID, CreatedAt: createdAt})
		addEdge(publicNetworkEdgeResponse{ID: "record-project:" + recordID, Source: recordNodeID, Target: projectNodes[projectID], Type: "result", Label: "形成于", RecordID: recordID, SourceProjectID: projectID, CreatedAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		writeError(w, http.StatusInternalServerError, "读取公开成果失败")
		return
	}
	rows.Close()

	rows, err = s.db.QueryContext(ctx, `
		SELECT s.id, s.status, s.created_at, s.source_record_id, s.call_id,
		       s.mapping_text, COALESCE(s.note, ''), r.title, r.summary,
		       source_project.id, source_project.title, target_project.id, target_project.title
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = s.call_id
		JOIN projects target_project ON target_project.id = c.project_id
		WHERE s.status IN ('submitted', 'adopted')
		  AND source_project.visibility = 'public' AND source_project.archived_at IS NULL
		  AND target_project.visibility = 'public' AND target_project.archived_at IS NULL
		ORDER BY s.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作关系失败")
		return
	}
	for rows.Next() {
		var submissionID, status, recordID, callID, mappingText, note, recordTitle, recordSummary string
		var sourceProjectID, sourceProjectTitle, targetProjectID, targetProjectTitle string
		var createdAt time.Time
		if err := rows.Scan(&submissionID, &status, &createdAt, &recordID, &callID, &mappingText, &note, &recordTitle, &recordSummary, &sourceProjectID, &sourceProjectTitle, &targetProjectID, &targetProjectTitle); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "读取协作关系失败")
			return
		}
		projectType, projectLabel := "contributing", "正在贡献"
		if status == "adopted" {
			projectType, projectLabel = "adopted", "正式采纳"
		}
		edge := publicNetworkEdgeResponse{RecordID: recordID, CallID: callID, Type: projectType, Label: projectLabel, Detail: mappingText, SourceProjectID: sourceProjectID, TargetProjectID: targetProjectID, SourceProjectTitle: sourceProjectTitle, TargetProjectTitle: targetProjectTitle, CreatedAt: createdAt}
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
		rows.Close()
		writeError(w, http.StatusInternalServerError, "读取协作关系失败")
		return
	}
	rows.Close()

	rows, err = s.db.QueryContext(ctx, `
		SELECT p.id, c.project_id, c.id, p.created_at
		FROM projects p JOIN collaboration_calls c ON c.id = p.contribution_call_id
		WHERE p.visibility = 'public' AND p.archived_at IS NULL
		  AND c.status = 'open'`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取贡献工作区关系失败")
		return
	}
	for rows.Next() {
		var sourceProjectID, targetProjectID, callID string
		var createdAt time.Time
		if err := rows.Scan(&sourceProjectID, &targetProjectID, &callID, &createdAt); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "读取贡献工作区关系失败")
			return
		}
		addEdge(publicNetworkEdgeResponse{ID: "workspace:" + sourceProjectID, Source: projectNodes[sourceProjectID], Target: projectNodes[targetProjectID], Type: "workspace", Label: "贡献工作区", CallID: callID, CreatedAt: createdAt})
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		writeError(w, http.StatusInternalServerError, "读取贡献工作区关系失败")
		return
	}
	rows.Close()

	weights := map[string]int{}
	for _, edge := range network.Edges {
		weights[edge.Source]++
		weights[edge.Target]++
	}
	for index := range network.Nodes {
		network.Nodes[index].Weight = weights[network.Nodes[index].ID]
	}
	writeJSON(w, http.StatusOK, network)
}
