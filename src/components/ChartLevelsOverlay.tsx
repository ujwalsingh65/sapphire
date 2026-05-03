import { Target, Shield, Flag, ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { SignalResult } from "@/components/SignalPanel";

interface Props {
  data: SignalResult | null;
}

const dirIcon = { BUY: ArrowUp, SELL: ArrowDown, NEUTRAL: Minus } as const;

export const ChartLevelsOverlay = ({ data }: Props) => {
  if (!data?.signal?.trade_plan?.valid) return null;
  const { entry, stop_loss, take_profit } = data.signal.trade_plan;
  const DirIcon = dirIcon[data.signal.direction];
  const risk = Math.abs(entry - stop_loss);
  const reward = Math.abs(take_profit - entry);
  const rr = risk > 0 ? reward / risk : 0;

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex w-[180px] flex-col gap-1.5">
      <div className="pointer-events-auto rounded-lg border border-border bg-background/85 p-2.5 shadow-card backdrop-blur-md">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <DirIcon className="h-3 w-3" />
            AI Plan · {data.signal.direction}
          </div>
          <span className="font-mono-tab text-[10px] text-muted-foreground">
            {Math.round(data.signal.confidence)}%
          </span>
        </div>
        <Row icon={Flag} label="TP" value={take_profit} accent="text-bull" />
        <Row icon={Target} label="Entry" value={entry} accent="text-foreground" />
        <Row icon={Shield} label="SL" value={stop_loss} accent="text-bear" />
        <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5 text-[10px]">
          <span className="text-muted-foreground">R:R</span>
          <span
            className={`font-mono-tab font-semibold ${
              rr >= 1.5 ? "text-bull" : "text-neutral-signal"
            }`}
          >
            1 : {rr.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

const Row = ({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Target;
  label: string;
  value: number;
  accent: string;
}) => (
  <div className="flex items-center justify-between py-0.5 text-xs">
    <div className={`flex items-center gap-1.5 ${accent}`}>
      <Icon className="h-3 w-3" />
      <span className="font-medium">{label}</span>
    </div>
    <span className={`font-mono-tab font-semibold ${accent}`}>{value.toFixed(2)}</span>
  </div>
);