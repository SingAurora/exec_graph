package app

import (
	"context"
	"net/http"
	"time"
)

type publicNetworkNodeResponse struct {
	ID            string `json:"id"`
	Kind          string `json:"kind"`
	Label         string `json:"label"`
	Detail        string `json:"detail"`
	ProjectID     string `json:"projectId,omitempty"`
	UserID        string `json:"userId,omitempty"`
	Weight        int    `json:"weight"`
	HasOpenCall   bool   `json:"hasOpenCall"`
	IsCurrentUser bool   `json:"isCurrentUser"`
}

type publicNetworkEdgeResponse struct {
	ID        string    `json:"id"`
	Source    string    `json:"source"`
	Target    string    `json:"target"`
	Type      string    `json:"type"`
	Label     string    `json:"label"`
	RecordID  string    `json:"recordId,omitempty"`
	CallID    string    `json:"callId,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

type publicNetworkResponse struct {
	Nodes []publicNetworkNodeResponse `json:"nodes"`
	Edges []publicNetworkEdgeResponse `json:"edges"`
}

// handleExploreNetwork projects real public collaboration facts into project and
// person views. It intentionally never fabricates co-worker relationships.
func (s *server) handleExploreNetwork(w http.ResponseWriter, r *http.Request) {
	user, ok := s.requireUser(w, r)
	if !ok {
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "不支持的请求方法")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()

	network := publicNetworkResponse{Nodes: make([]publicNetworkNodeResponse, 0), Edges: make([]publicNetworkEdgeResponse, 0)}
	nodeIndex := map[string]int{}
	projectNodes := map[string]string{}
	personNodes := map[uint64]string{}
	ensurePerson := func(id uint64, name, handle string) string {
		if nodeID, exists := personNodes[id]; exists {
			return nodeID
		}
		nodeID := "person:" + handle
		personNodes[id] = nodeID
		nodeIndex[nodeID] = len(network.Nodes)
		network.Nodes = append(network.Nodes, publicNetworkNodeResponse{ID: nodeID, Kind: "person", Label: name, Detail: "@" + handle, UserID: handle, IsCurrentUser: id == user.ID})
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
		SELECT s.id, s.status, s.created_at, s.source_record_id, s.call_id,
		       source_project.id, target_project.id,
		       contributor.id, contributor.username, contributor.user_id,
		       target_owner.id, target_owner.username, target_owner.user_id
		FROM collaboration_submissions s
		JOIN completion_records r ON r.id = s.source_record_id
		JOIN projects source_project ON source_project.id = r.project_id
		JOIN collaboration_calls c ON c.id = s.call_id
		JOIN projects target_project ON target_project.id = c.project_id
		JOIN users contributor ON contributor.id = s.contributor_id
		JOIN users target_owner ON target_owner.id = target_project.owner_id
		WHERE s.status IN ('submitted', 'adopted')
		  AND source_project.visibility = 'public' AND source_project.archived_at IS NULL
		  AND target_project.visibility = 'public' AND target_project.archived_at IS NULL
		ORDER BY s.created_at ASC`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "读取协作关系失败")
		return
	}
	for rows.Next() {
		var submissionID, status, recordID, callID, sourceProjectID, targetProjectID string
		var createdAt time.Time
		var contributorID, targetOwnerID uint64
		var contributorName, contributorHandle, targetOwnerName, targetOwnerHandle string
		if err := rows.Scan(&submissionID, &status, &createdAt, &recordID, &callID, &sourceProjectID, &targetProjectID, &contributorID, &contributorName, &contributorHandle, &targetOwnerID, &targetOwnerName, &targetOwnerHandle); err != nil {
			rows.Close()
			writeError(w, http.StatusInternalServerError, "读取协作关系失败")
			return
		}
		projectType, projectLabel := "contributing", "正在贡献"
		personType, personLabel := "contributing", "正在为其贡献"
		if status == "adopted" {
			projectType, projectLabel = "adopted", "正式采纳"
			personType, personLabel = "adopted", "成果被采用"
		}
		addEdge(publicNetworkEdgeResponse{ID: "project-submission:" + submissionID, Source: projectNodes[sourceProjectID], Target: projectNodes[targetProjectID], Type: projectType, Label: projectLabel, RecordID: recordID, CallID: callID, CreatedAt: createdAt})
		contributorNodeID := ensurePerson(contributorID, contributorName, contributorHandle)
		targetOwnerNodeID := ensurePerson(targetOwnerID, targetOwnerName, targetOwnerHandle)
		addEdge(publicNetworkEdgeResponse{ID: "person-submission:" + submissionID, Source: contributorNodeID, Target: targetOwnerNodeID, Type: personType, Label: personLabel, RecordID: recordID, CallID: callID, CreatedAt: createdAt})
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
	if err == nil {
		for rows.Next() {
			var sourceProjectID, targetProjectID, callID string
			var createdAt time.Time
			if err := rows.Scan(&sourceProjectID, &targetProjectID, &callID, &createdAt); err == nil {
				addEdge(publicNetworkEdgeResponse{ID: "workspace:" + sourceProjectID, Source: projectNodes[sourceProjectID], Target: projectNodes[targetProjectID], Type: "workspace", Label: "贡献工作区", CallID: callID, CreatedAt: createdAt})
			}
		}
		rows.Close()
	}

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
