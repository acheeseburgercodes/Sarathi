"use client";
/* Full document links avoid the deployed vinext client-router failure. */
/* eslint-disable @next/next/no-html-link-for-pages */

import dynamic from "next/dynamic";
import { Component, type ErrorInfo, type ReactNode, useState } from "react";
import { ArrowUpRight, CloudRain, Globe2, Network, Search, Waves } from "lucide-react";

const Spline = dynamic(() => import("@splinetool/react-spline"), {
  ssr: false,
  loading: () => <div className="spline-loading"><i/><span>Loading 3D agent field</span></div>,
});

class SplineBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("Spline scene unavailable", error.message, info.componentStack);
  }
  render() {
    return this.state.failed
      ? <div className="spline-fallback"><Network/><b>3D agent field unavailable</b><span>The live agent workspace remains available.</span></div>
      : this.props.children;
  }
}

const specialists = [
  [CloudRain, "Weather"],
  [Globe2, "Climate"],
  [Search, "News"],
  [Waves, "Events"],
] as const;

export function AgentSplineSection() {
  const [loaded, setLoaded] = useState(false);
  return <section className="agent-spline" data-reveal data-slide="left" aria-label="Interactive three-dimensional view of the Sarathi multi-agent system">
    <div className="spline-spotlight" aria-hidden="true"/>
    <div className="spline-copy">
      <span className="eyebrow">02 / MULTI-AGENT NETWORK</span>
      <h2>One coordinator.<br/>Only the agents you need.</h2>
      <p>The router activates relevant specialists, preserves their source evidence, and passes compact findings to Sarathi Central.</p>
      <div className="spline-agent-list">{specialists.map(([Icon, label]) => <span key={label}><Icon/>{label}</span>)}</div>
      <a className="button subtle" href="/agents">Inspect the agent workflow <ArrowUpRight/></a>
    </div>
    <div className="spline-stage">
      {!loaded && <div className="spline-loading"><i/><span>Loading 3D agent field</span></div>}
      <SplineBoundary>
        <Spline scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode" onLoad={() => setLoaded(true)} renderOnDemand className={loaded ? "is-loaded" : ""}/>
      </SplineBoundary>
      <div className="spline-stage-label"><Network/><span><b>SARATHI CENTRAL</b><small>Interactive coordination field</small></span></div>
    </div>
  </section>;
}
