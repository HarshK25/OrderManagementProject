package com.ordermanagement.audit.service;

import com.ordermanagement.audit.entity.AuditLog;
import com.ordermanagement.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public void record(String actorEmail, String action, String entityType, String entityId, String details) {
        try {
            auditLogRepository.save(AuditLog.builder()
                    .actorEmail(actorEmail != null ? actorEmail : "system")
                    .action(action)
                    .entityType(entityType)
                    .entityId(entityId)
                    .details(details)
                    .build());
        } catch (Exception ex) {
            log.warn("Failed to write audit log: {}", ex.getMessage());
        }
    }

    public List<AuditLog> getRecentLogs() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc();
    }
}
