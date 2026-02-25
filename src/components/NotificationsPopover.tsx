import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, CheckCircle2, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function NotificationsPopover() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const playCountRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const playSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const audioCtx = new AudioContext();
      const playBeep = (time: number) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, time);
        gainNode.gain.setValueAtTime(0.1, time);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, time + 0.3);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start(time);
        oscillator.stop(time + 0.3);
      };
      playBeep(audioCtx.currentTime);
      playBeep(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log("Áudio bloqueado. Requer interação com a página.", e);
    }
  };

  const startSoundAlarm = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    playCountRef.current = 0;
    playSound();
    playCountRef.current += 1;

    intervalRef.current = setInterval(() => {
      if (playCountRef.current < 10) {
        playSound();
        playCountRef.current += 1;
      } else {
        stopSoundAlarm();
      }
    }, 60000); 
  };

  const stopSoundAlarm = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const fetchNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

// ==========================================
  // TEMPO REAL: MOTOR EXCLUSIVO (CapiFit Style)
  // ==========================================
  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();

    // 💡 CORREÇÃO 1: Nome de canal ÚNICO para não sofrer interferência de outras páginas
    const channelName = `realtime-alerts-${user.id}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`, // Filtra só as mensagens deste utilizador
        },
        (payload) => {
          console.log("⚡ [Realtime] Nova notificação recebida na hora!", payload);
          
          const newNotif = payload.new;
          setNotifications((prev) => [newNotif, ...prev]);
          
          setUnreadCount((prev) => {
            const newCount = prev + 1;
            playCountRef.current = 0; // Renova os 10 minutos
            return newCount;
          });
          
          // Verifica se é urgente para tocar o alarme
          const title = (newNotif.title || "").toLowerCase();
          const isUrgent = title.includes("cancelado") || 
                           title.includes("cancelamento") || 
                           title.includes("iminente") || 
                           title.includes("lembrete") || 
                           title.includes("atenção");

          if (isUrgent) {
            startSoundAlarm();
          }
        }
      )
      .subscribe((status, err) => {
        // 💡 CORREÇÃO 2: Feedback visual no F12 para ter certeza que está ligado
        console.log(`🔌 [Realtime] Status do canal ${channelName}:`, status);
        if (err) console.error("🔌 [Realtime] Erro na conexão:", err);
      });

    return () => {
      // Limpeza segura ao deslogar
      supabase.removeChannel(channel);
      stopSoundAlarm();
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    stopSoundAlarm();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    stopSoundAlarm();
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  };

  const deleteAll = async () => {
    if (!window.confirm("Deseja apagar todas as notificações?")) return;
    setNotifications([]);
    setUnreadCount(0);
    stopSoundAlarm();
    await supabase.from("notifications").delete().eq("user_id", user?.id);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-500 text-white rounded-full text-xs animate-pulse border border-white">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl border-slate-200">
        <div className="flex items-center justify-between p-4 border-b bg-slate-50/50">
          <h4 className="font-semibold text-sm text-slate-800">Alertas</h4>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" title="Marcar todas como lidas" onClick={markAllAsRead} disabled={unreadCount === 0} className="h-8 w-8">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </Button>
            <Button variant="ghost" size="icon" title="Limpar histórico" onClick={deleteAll} disabled={notifications.length === 0} className="h-8 w-8 hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4 w-4 text-slate-400" />
            </Button>
          </div>
        </div>
        <ScrollArea className="h-[350px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-3">
              <div className="bg-slate-100 p-3 rounded-full">
                <Bell className="h-6 w-6 text-slate-400" />
              </div>
              Nenhuma notificação no momento.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 border-b last:border-0 transition-colors flex gap-3 ${
                    n.is_read ? "bg-white" : "bg-indigo-50/60"
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <p className={`text-sm ${n.is_read ? "text-slate-600" : "text-slate-900 font-semibold"}`}>
                      {n.title}
                    </p>
                    <p className={`text-xs ${n.is_read ? "text-slate-500" : "text-slate-700"}`}>
                      {n.message}
                    </p>
                    <p className="text-[10px] text-slate-400 pt-1 flex items-center gap-1">
                      {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                  {!n.is_read && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 shrink-0 text-indigo-600 hover:bg-indigo-100 mt-1" 
                      onClick={() => markAsRead(n.id)}
                      title="Marcar como lida"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}