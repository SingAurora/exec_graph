package collaboration

import (
	"context"

	"gorm.io/gorm"
)

func (repository *Repository) ListCallIDs(ctx context.Context, projectUUID string) ([]string, error) {
	var ids []string
	err := repository.db.WithContext(ctx).Model(&CollaborationCall{}).
		Joins("JOIN projects AS p ON p.id = collaboration_calls.project_id").
		Where("p.uuid = ?", projectUUID).
		Order("CASE WHEN collaboration_calls.status = 'open' THEN 0 ELSE 1 END").
		Order("collaboration_calls.created_at DESC").
		Pluck("collaboration_calls.uuid", &ids).Error
	return ids, err
}

func (repository *Repository) FindCall(ctx context.Context, callUUID string) (CallView, error) {
	calls, err := repository.findCalls(ctx, []string{callUUID})
	if err != nil {
		return CallView{}, err
	}
	call, exists := calls[callUUID]
	if !exists {
		return CallView{}, ErrNotFound
	}
	return call, nil
}

func (repository *Repository) findCalls(ctx context.Context, callUUIDs []string) (map[string]CallView, error) {
	uniqueUUIDs := uniqueStrings(callUUIDs)
	result := make(map[string]CallView, len(uniqueUUIDs))
	if len(uniqueUUIDs) == 0 {
		return result, nil
	}

	var calls []CallView
	if err := repository.callQuery(ctx).Where("c.uuid IN ?", uniqueUUIDs).Scan(&calls).Error; err != nil {
		return nil, err
	}
	type submissionCount struct {
		CallUUID string `gorm:"column:call_uuid"`
		Count    int    `gorm:"column:submission_count"`
	}
	var counts []submissionCount
	if err := repository.db.WithContext(ctx).Table("collaboration_submissions AS s").
		Select("c.uuid AS call_uuid, COUNT(*) AS submission_count").
		Joins("JOIN collaboration_calls AS c ON c.id = s.call_id").
		Where("c.uuid IN ? AND s.status <> ?", uniqueUUIDs, "withdrawn").
		Group("c.uuid").
		Scan(&counts).Error; err != nil {
		return nil, err
	}
	countsByCall := make(map[string]int, len(counts))
	for _, count := range counts {
		countsByCall[count.CallUUID] = count.Count
	}
	for _, call := range calls {
		call.SubmissionCount = countsByCall[call.ID]
		result[call.ID] = call
	}
	return result, nil
}

func (repository *Repository) callQuery(ctx context.Context) *gorm.DB {
	return repository.db.WithContext(ctx).Table("collaboration_calls AS c").
		Select("c.id AS internal_id, c.uuid AS id, p.uuid AS project_id, p.title AS project_title, u.username AS owner_name, u.user_id AS owner_user_id, c.created_by, creator.user_id AS created_by_user_id, c.title, c.status, c.max_submissions, c.created_at, n.uuid AS target_id, n.title AS target_title, n.verifiable_goal, n.acceptance_criteria_json, n.evidence_requirement, n.stage").
		Joins("JOIN projects AS p ON p.id = c.project_id").
		Joins("JOIN users AS u ON u.id = p.owner_id").
		Joins("JOIN users AS creator ON creator.id = c.created_by").
		Joins("JOIN execution_contracts AS n ON n.id = c.target_contract_id")
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
