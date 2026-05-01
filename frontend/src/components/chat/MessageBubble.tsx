import { cn } from "@/lib/utils";
import type { ChatMsg } from "@/hooks/useChatWebSocket";

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function MessageBubble({
  msg,
  myUserId,
}: {
  msg: ChatMsg;
  myUserId: string;
}) {
  const isMe = msg.sender_id === myUserId;
  const isBot = msg.is_ai_icebreaker;

  if (isBot) {
    return (
      <div className="flex justify-center my-3">
        <div className="max-w-xs bg-clout-dim border border-clout/30 rounded-2xl px-4 py-2 text-center">
          <p className="text-xs text-clout font-medium mb-1">CampusBot</p>
          <p className="text-sm text-text-primary">{msg.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2 mb-2", isMe ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold",
          isMe ? "bg-accent-dim text-accent" : "bg-surface-raised text-text-muted"
        )}
      >
        {(msg.sender_username?.[0] ?? "?").toUpperCase()}
      </div>

      <div className={cn("flex flex-col gap-0.5 max-w-[70%]", isMe && "items-end")}>
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm leading-relaxed",
            isMe
              ? "bg-accent text-background rounded-tr-sm"
              : "bg-surface-raised text-text-primary rounded-tl-sm"
          )}
        >
          {msg.content}
        </div>
        <div className="flex items-center gap-2 px-1">
          <span className="text-xs text-text-muted">{timeStr(msg.created_at)}</span>
          {msg.token_cost > 0 && (
            <span className="text-xs text-clout font-mono">-{msg.token_cost}◈</span>
          )}
        </div>
      </div>
    </div>
  );
}
