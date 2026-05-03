import { Link } from "react-router-dom";
import { LineChart, Sparkles, History, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/sapphire-logo.png";

const Home = () => {
  return (
    <section className="container py-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <img src={logo} alt="Sapphire Trader logo" className="h-28 w-28 object-contain" />
        <h2 className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">
          Sapphire Trader
        </h2>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          AI-powered multi-timeframe analysis with TradingView charts and Gemini Vision pattern recognition.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="gap-2 shadow-glow">
            <Link to="/analysis">
              <Sparkles className="h-5 w-5" />
              Open Analysis
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <Link to="/history">
              <History className="h-5 w-5" />
              View history
            </Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
        <FeatureCard
          icon={LineChart}
          title="Full TradingView"
          desc="Drawing tools, 100+ indicators, multi-chart styles, compare, news & calendar."
        />
        <FeatureCard
          icon={Sparkles}
          title="Gemini Vision"
          desc="Sends a chart screenshot to Gemini Pro for true visual pattern recognition."
        />
        <FeatureCard
          icon={Settings}
          title="Multi-timeframe"
          desc="Always returns predictions for the next 3 / 10 / 30 candles with trade plan."
        />
      </div>
    </section>
  );
};

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof LineChart;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <Icon className="h-6 w-6 text-primary" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

export default Home;