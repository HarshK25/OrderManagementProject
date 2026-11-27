package com.ordermanagement.notification.controller;

import com.ordermanagement.notification.entity.InAppNotification;
import com.ordermanagement.notification.repository.InAppNotificationRepository;
import com.ordermanagement.user.entity.User;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Tag(name = "Notifications", description = "In-app notification center")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final InAppNotificationRepository notificationRepository;

    public record NotificationDto(Long id, String title, String message, String type,
                                  boolean read, String link, String createdAt) {
        static NotificationDto from(InAppNotification n) {
            return new NotificationDto(n.getId(), n.getTitle(), n.getMessage(),
                    n.getType(), n.isReadFlag(), n.getLink(), n.getCreatedAt().toString());
        }
    }

    @GetMapping
    @Operation(summary = "Get recent notifications and unread count")
    public Map<String, Object> list(@AuthenticationPrincipal User user) {
        List<NotificationDto> items = notificationRepository
                .findTop30ByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(NotificationDto::from).toList();
        long unread = notificationRepository.countByUserIdAndReadFlagFalse(user.getId());
        return Map.of("unreadCount", unread, "items", items);
    }

    @PatchMapping("/read-all")
    @Transactional
    @Operation(summary = "Mark all notifications as read")
    public Map<String, Object> markAllRead(@AuthenticationPrincipal User user) {
        List<InAppNotification> list = notificationRepository.findTop30ByUserIdOrderByCreatedAtDesc(user.getId());
        list.forEach(n -> n.setReadFlag(true));
        notificationRepository.saveAll(list);
        return Map.of("unreadCount", 0);
    }
}
