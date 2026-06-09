"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  AlertTriangle, 
  Map, 
  Cpu, 
  Layers, 
  MessageSquare, 
  Calendar, 
  Sliders, 
  Activity, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  TrendingUp, 
  Leaf, 
  DollarSign, 
  Clock, 
  User, 
  Send,
  Zap,
  Globe,
  CornerDownRight
} from "lucide-react";

// Types matching backend payloads
interface DashboardMetrics {
  total_components: number;
  delayed_components: number;
  average_delay_days: number;
  project_delay_days: number;
  projected_launch_date: string;
}

interface Alert {
  severity: "critical" | "warning";
  component: string;
  message: string;
}

interface Shipment {
  id: number;
  component_id: number;
  component_name: string;
  category: string;
  supplier_name: string;
  origin: string;
  destination: string;
  shipping_method: string;
  port_of_entry: string;
  status: string;
  delay_risk_percent: number;
  expected_delay_days: number;
  current_lat: number;
  current_lng: number;
  departure_date: string;
  estimated_delivery_date: string;
}

interface CriticalPathEvent {
  component_id: number;
  name: string;
  category: string;
  start_day: number;
  duration_days: number;
  end_day: number;
  is_delayed: boolean;
  delay_days: number;
  is_critical: boolean;
}

interface SimulationResult {
  total_project_days: number;
  project_launch_date: string;
  project_delay_days: number;
  critical_path: CriticalPathEvent[];
}

interface Supplier {
  id: number;
  name: string;
  category: string;
  country: string;
  reliability_score: number;
  base_cost_usd: number;
  carbon_footprint_co2: number;
  tariff_exposure_pct: number;
  lead_time_days: number;
}

interface OptimizedSupplierRecommendation {
  supplier: Supplier;
  score: number;
  estimated_lead_time_days: number;
  estimated_cost_usd: number;
  carbon_footprint_co2: number;
  tariff_exposure_pct: number;
  pros: string[];
  cons: string[];
}

interface Citation {
  title: string;
  category: string;
  snippet: string;
  relevance_score: number;
}

interface ChatMessage {
  id: string;
  sender: "user" | "copilot";
  text: string;
  citations?: Citation[];
}

interface KafkaEvent {
  event: string;
  shipment: string;
  message: string;
  details?: any;
  timestamp: string;
}

export default function Home() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "simulator" | "optimizer" | "copilot">("dashboard");

  // State elements
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Kafka live event logs
  const [kafkaLogs, setKafkaLogs] = useState<KafkaEvent[]>([]);

  // Simulation state
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [manualDelays, setManualDelays] = useState<Record<number, number>>({});
  const [loadingSim, setLoadingSim] = useState(false);

  // Sourcing Optimizer state
  const [optCategory, setOptCategory] = useState("Transformer");
  const [weightCost, setWeightCost] = useState(30);
  const [weightTime, setWeightTime] = useState(30);
  const [weightRisk, setWeightRisk] = useState(20);
  const [weightCarbon, setWeightCarbon] = useState(10);
  const [weightTariff, setWeightTariff] = useState(10);
  const [optResult, setOptResult] = useState<{ current_supplier: Supplier | null; recommendations: OptimizedSupplierRecommendation[] } | null>(null);
  const [loadingOpt, setLoadingOpt] = useState(false);

  // Copilot Chat state
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "copilot",
      text: "Welcome to the AI Procurement Copilot. Ask me about critical bottlenecks, re-routing alternatives, or contract clauses (e.g. liquidated damages or Force Majeure clauses)."
    }
  ]);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initial Data Load
  const fetchDashboardData = async () => {
    try {
      setLoadingDashboard(true);
      const res = await fetch("http://localhost:8000/api/dashboard/");
      const data = await res.json();
      setMetrics(data.metrics);
      setAlerts(data.alerts);
      setShipments(data.shipments);
      
      // Auto-select first shipment for details card
      if (data.shipments.length > 0 && !selectedShipment) {
        setSelectedShipment(data.shipments[0]);
      }
      setLoadingDashboard(false);
    } catch (e) {
      console.error("Error fetching dashboard summary", e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Connect to Kafka SSE Stream
  useEffect(() => {
    const eventSource = new EventSource("http://localhost:8000/events");
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newLog: KafkaEvent = {
          event: data.event,
          shipment: data.shipment || "System",
          message: data.message,
          details: data.details,
          timestamp: new Date().toLocaleTimeString()
        };
        setKafkaLogs((prev) => [newLog, ...prev.slice(0, 24)]); // Cap at 25 events
      } catch (err) {
        console.error("Failed to parse SSE event", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Run Scheduling Simulation
  const runSimulation = async (overrides: Record<number, number>) => {
    try {
      setLoadingSim(true);
      const res = await fetch("http://localhost:8000/api/simulator/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manual_delays: overrides })
      });
      const data = await res.json();
      setSimResult(data);
      setLoadingSim(false);
    } catch (err) {
      console.error("Simulator request failed", err);
      setLoadingSim(false);
    }
  };

  // Trigger simulation whenever manual delays change or tab opens
  useEffect(() => {
    if (activeTab === "simulator") {
      runSimulation(manualDelays);
    }
  }, [manualDelays, activeTab]);

  // Run Supplier Sourcing Optimization
  const runOptimization = async () => {
    try {
      setLoadingOpt(true);
      const res = await fetch("http://localhost:8000/api/optimizer/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_category: optCategory,
          weight_cost: weightCost / 100,
          weight_lead_time: weightTime / 100,
          weight_risk: weightRisk / 100,
          weight_carbon: weightCarbon / 100,
          weight_tariff: weightTariff / 100
        })
      });
      const data = await res.json();
      setOptResult(data);
      setLoadingOpt(false);
    } catch (err) {
      console.error("Optimization failed", err);
      setLoadingOpt(false);
    }
  };

  useEffect(() => {
    if (activeTab === "optimizer") {
      runOptimization();
    }
  }, [optCategory, weightCost, weightTime, weightRisk, weightCarbon, weightTariff, activeTab]);

  // Handle Copilot messages
  const sendChatMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: "user",
      text
    };

    setChatLog((prev) => [...prev, userMsg]);
    setChatInput("");
    setLoadingChat(true);

    try {
      const res = await fetch("http://localhost:8000/api/copilot/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: text })
      });
      const data = await res.json();
      
      const copilotMsg: ChatMessage = {
        id: Math.random().toString(),
        sender: "copilot",
        text: data.answer,
        citations: data.citations
      };
      
      setChatLog((prev) => [...prev, copilotMsg]);
      setLoadingChat(false);
    } catch (err) {
      console.error("Copilot request failed", err);
      setLoadingChat(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, loadingChat]);

  // Handle preset queries in Copilot
  const handlePresetQuery = (queryText: string) => {
    sendChatMessage(queryText);
  };

  const handleSliderChange = (compId: number, val: number) => {
    setManualDelays((prev) => ({
      ...prev,
      [compId]: val
    }));
  };

  const resetSimulator = () => {
    setManualDelays({});
  };

  return (
    <div className="min-h-screen bg-[#05070f] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-800 bg-[#070b19] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-cyan-500 to-indigo-600 p-2.5 rounded-xl glow-cyan">
            <Cpu className="w-6 h-6 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-indigo-200 to-white bg-clip-text text-transparent">
              SECURESYNC
            </h1>
            <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase">
              AI Data Center Supply Chain Risk Platform
            </p>
          </div>
        </div>

        {/* Global tab selectors */}
        <nav className="flex items-center bg-[#0d122b] border border-slate-800 rounded-xl p-1">
          <button 
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-cyan-500 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
          >
            <Map className="w-4 h-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "simulator" ? "bg-cyan-500 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
          >
            <Calendar className="w-4 h-4" />
            Build Simulator
          </button>
          <button 
            onClick={() => setActiveTab("optimizer")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "optimizer" ? "bg-cyan-500 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
          >
            <Sliders className="w-4 h-4" />
            Sourcing Optimizer
          </button>
          <button 
            onClick={() => setActiveTab("copilot")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "copilot" ? "bg-cyan-500 text-black shadow-lg" : "text-slate-400 hover:text-white"}`}
          >
            <MessageSquare className="w-4 h-4" />
            Copilot
          </button>
        </nav>
      </header>

      {/* ACTIVE RISK ALERT MARQUEE BANNER */}
      {alerts.length > 0 && (
        <div className="bg-[#180814] border-b border-rose-950/40 text-rose-300 py-2.5 px-6 overflow-hidden relative flex items-center gap-3">
          <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 animate-pulse" />
          <div className="flex animate-marquee gap-8 whitespace-nowrap text-xs font-medium tracking-wide">
            {alerts.map((alert, idx) => (
              <span key={idx} className="mr-8">
                <span className={`inline-block mr-1.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${alert.severity === "critical" ? "bg-rose-500 text-black" : "bg-amber-500 text-black"}`}>
                  {alert.severity}
                </span>
                {alert.message}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* CORE CONTENT LAYOUT */}
      <main className="flex-1 p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        
        {/* TAB 1: RISK DASHBOARD & TELEMETRY */}
        {activeTab === "dashboard" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* KPI Metrics row */}
            {loadingDashboard ? (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="glass-card p-5 h-24 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : metrics && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Project Launch Date</span>
                  <span className="text-lg font-black text-cyan-400 tracking-tight mt-1">{metrics.projected_launch_date}</span>
                </div>
                <div className="glass-card p-5 rounded-2xl flex flex-col justify-between border-l-2 border-l-cyan-500">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Build Delay Slip</span>
                  <span className={`text-2xl font-black mt-1 ${metrics.project_delay_days > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                    {metrics.project_delay_days} Days
                  </span>
                </div>
                <div className="glass-card p-5 rounded-2xl flex flex-col justify-between">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Tracked Components</span>
                  <span className="text-3xl font-black text-white mt-1">{metrics.total_components}</span>
                </div>
                <div className="glass-card p-5 rounded-2xl flex flex-col justify-between border-l-2 border-l-amber-500">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Delayed Shipments</span>
                  <span className="text-3xl font-black text-amber-400 mt-1">{metrics.delayed_components}</span>
                </div>
                <div className="glass-card p-5 rounded-2xl flex flex-col justify-between col-span-2 lg:col-span-1">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avg Shipment Delay</span>
                  <span className="text-3xl font-black text-slate-100 mt-1">{metrics.average_delay_days} <span className="text-xs text-slate-400">days</span></span>
                </div>
              </div>
            )}

            {/* Interactive map & details row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Map Panel (2/3 width) */}
              <div className="glass-card rounded-2xl p-4 lg:col-span-2 flex flex-col min-h-[420px]">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-sm tracking-wide uppercase">Global Sourcing Logistics Telemetry</h3>
                  </div>
                  <span className="text-xs text-slate-400 italic">Click markers for details</span>
                </div>

                <div className="flex-1 bg-[#03050b] rounded-xl border border-slate-900 overflow-hidden relative flex items-center justify-center p-2">
                  
                  {/* SVG Global Shipping Map */}
                  <svg viewBox="0 0 1000 400" className="w-full h-full select-none max-h-[350px]">
                    
                    {/* Simplified continent shapes for background */}
                    {/* North America */}
                    <path d="M 50,50 L 250,50 L 280,120 L 230,220 L 200,220 L 150,180 L 140,240 L 120,250 L 110,210 L 50,150 Z" fill="#090d22" stroke="#12183a" strokeWidth="1" />
                    {/* South America */}
                    <path d="M 200,230 L 240,250 L 280,310 L 250,380 L 230,390 L 210,340 L 190,260 Z" fill="#090d22" stroke="#12183a" strokeWidth="1" />
                    {/* Europe */}
                    <path d="M 400,60 L 520,60 L 540,110 L 490,180 L 440,180 L 410,130 Z" fill="#090d22" stroke="#12183a" strokeWidth="1" />
                    {/* Asia */}
                    <path d="M 530,60 L 850,60 L 880,180 L 840,260 L 760,250 L 680,260 L 540,170 Z" fill="#090d22" stroke="#12183a" strokeWidth="1" />
                    {/* Australia */}
                    <path d="M 780,280 L 860,290 L 880,350 L 800,350 Z" fill="#090d22" stroke="#12183a" strokeWidth="1" />

                    {/* Shipping Routes (bezier curves) */}
                    {shipments.map((s) => {
                      // Define coordinates mapping
                      // Dallas: 210, 150
                      const destX = 210;
                      const destY = 150;
                      let origX = 210;
                      let origY = 150;
                      let color = "#10b981"; // safe green

                      if (s.origin === "Germany") { origX = 460; origY = 100; color = s.expected_delay_days > 15 ? "#f43f5e" : "#eab308"; }
                      else if (s.origin === "Italy") { origX = 490; origY = 125; color = s.current_status === "Customs Hold" ? "#f59e0b" : "#eab308"; }
                      else if (s.origin === "France") { origX = 445; origY = 115; color = "#10b981"; }
                      else if (s.origin === "Denmark") { origX = 455; origY = 85; color = "#06b6d4"; }
                      else if (s.origin === "Japan") { origX = 770; origY = 135; color = s.current_status === "Port Congested" ? "#f59e0b" : "#10b981"; }
                      else if (s.origin === "Taiwan") { origX = 745; origY = 185; color = "#f59e0b"; }
                      else if (s.origin === "USA") { 
                        // Local roads
                        origX = s.component_name.includes("Fiber") ? 130 : 250; 
                        origY = s.component_name.includes("Fiber") ? 100 : 120;
                        color = "#10b981";
                      }

                      // Midpoint for curve control
                      const midX = (origX + destX) / 2;
                      const midY = (origY + destY) / 2 - 40; // Curve arc height

                      return (
                        <g key={s.id}>
                          {/* Shipping Lane Line */}
                          <path
                            d={`M ${origX} ${origY} Q ${midX} ${midY} ${destX} ${destY}`}
                            fill="none"
                            stroke={color}
                            strokeWidth="1.5"
                            className="map-route-dash opacity-70"
                          />

                          {/* Pulsing warning indicator if delayed */}
                          {s.expected_delay_days > 0 && (
                            <circle
                              cx={origX}
                              cy={origY}
                              r="10"
                              fill="none"
                              stroke={color}
                              strokeWidth="2"
                              className="pulse-glow-node"
                            />
                          )}

                          {/* Shipment marker point */}
                          <circle
                            cx={origX}
                            cy={origY}
                            r="5"
                            fill={color}
                            className="cursor-pointer hover:r-7 transition-all"
                            onClick={() => setSelectedShipment(s)}
                          />
                        </g>
                      );
                    })}

                    {/* Destination Marker (Dallas AI-1 Data Center) */}
                    <circle cx="210" cy="150" r="7" fill="#06b6d4" className="glow-cyan" />
                    <text x="210" y="138" fill="#e2e8f0" fontSize="10" fontWeight="bold" textAnchor="middle">
                      DALLAS AI-1
                    </text>
                  </svg>

                  {/* Tiny Legend */}
                  <div className="absolute bottom-3 right-4 flex gap-4 text-[10px] text-slate-400 glass-card px-3 py-1.5 rounded-lg border border-slate-900 bg-black/40">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      <span>On Schedule</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                      <span>Congested/Hold</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                      <span>Critical Delay</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Shipment Details Panel */}
              <div className="glass-card rounded-2xl p-5 flex flex-col justify-between min-h-[420px]">
                {selectedShipment ? (
                  <div className="flex flex-col h-full justify-between">
                    <div>
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
                            {selectedShipment.category}
                          </span>
                          <h4 className="font-extrabold text-base text-white mt-0.5">
                            {selectedShipment.component_name}
                          </h4>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          selectedShipment.status === "Delivered" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                          selectedShipment.status === "Customs Hold" ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" :
                          selectedShipment.status === "Port Congested" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                          "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                        }`}>
                          {selectedShipment.status}
                        </span>
                      </div>

                      {/* Detail attributes */}
                      <div className="grid grid-cols-2 gap-4 my-4 text-xs">
                        <div>
                          <span className="text-slate-400 font-medium block">Sourced Vendor</span>
                          <span className="font-bold text-slate-100">{selectedShipment.supplier_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Origin Country</span>
                          <span className="font-bold text-slate-100">{selectedShipment.origin}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Shipping Route</span>
                          <span className="font-bold text-slate-100">{selectedShipment.shipping_method} via {selectedShipment.port_of_entry}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-medium block">Estimated Arrival</span>
                          <span className="font-bold text-slate-100">{selectedShipment.estimated_delivery_date}</span>
                        </div>
                      </div>

                      {/* Risk factors scores */}
                      <div className="bg-[#03050b] rounded-xl p-4 border border-slate-900 flex flex-col gap-3">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="text-xs font-semibold text-slate-400">Delay Risk Metrics</span>
                          <span className="text-xs font-bold text-rose-400">{selectedShipment.delay_risk_percent}% Probability</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-300">Expected Slip Duration</span>
                          <span className="text-sm font-black text-rose-400">{selectedShipment.expected_delay_days} Days</span>
                        </div>

                        {/* Factor list summary */}
                        <div className="text-[10px] text-slate-500 flex flex-col gap-1.5 mt-1">
                          {selectedShipment.origin === "Germany" && (
                            <>
                              <div className="flex justify-between">
                                <span>- Houston Port seasonal container surge</span>
                                <span className="font-semibold text-slate-400">55% risk</span>
                              </div>
                              <div className="flex justify-between">
                                <span>- Atlantic maritime storm routes</span>
                                <span className="font-semibold text-slate-400">20% risk</span>
                              </div>
                            </>
                          )}
                          {selectedShipment.origin === "Italy" && (
                            <div className="flex justify-between">
                              <span>- Customs hold on import tariff auditing</span>
                              <span className="font-semibold text-slate-400">100% Active</span>
                            </div>
                          )}
                          {selectedShipment.origin === "Japan" && (
                            <div className="flex justify-between">
                              <span>- Los Angeles terminal upgrades backlog</span>
                              <span className="font-semibold text-slate-400">100% Active</span>
                            </div>
                          )}
                          {selectedShipment.origin === "Taiwan" && (
                            <div className="flex justify-between">
                              <span>- Taiwan Strait naval maneuvers warning</span>
                              <span className="font-semibold text-slate-400">65% risk</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setOptCategory(selectedShipment.category);
                        setActiveTab("optimizer");
                      }}
                      className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-cyan-400 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 mt-4 group"
                    >
                      Optimize Suppliers for Category
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
                    Select a shipment node to inspect details
                  </div>
                )}
              </div>
            </div>

            {/* Live event streaming logs widget */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h3 className="font-bold text-sm tracking-wide uppercase">Kafka Live Sourcing Event Stream</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase font-black tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping" />
                  Live Stream
                </div>
              </div>

              <div className="bg-[#03050b] rounded-xl border border-slate-900 h-36 overflow-y-auto p-3 flex flex-col-reverse gap-2">
                {kafkaLogs.length > 0 ? (
                  kafkaLogs.map((log, index) => {
                    let color = "text-slate-300";
                    if (log.event === "customs_alert") color = "text-amber-300 border-l-2 border-l-amber-500 pl-2";
                    else if (log.event === "weather_warning") color = "text-rose-300 border-l-2 border-l-rose-500 pl-2";
                    else if (log.event === "status_change") color = "text-cyan-300 border-l-2 border-l-cyan-500 pl-2";
                    
                    return (
                      <div key={index} className={`text-xs ${color} flex items-start gap-3 py-1 border-b border-slate-950`}>
                        <span className="text-[10px] text-slate-500 font-semibold mt-0.5 uppercase tracking-wider">{log.timestamp}</span>
                        <div>
                          <span className="font-extrabold mr-1.5">[{log.event.toUpperCase()}]</span>
                          {log.message}
                          {log.details && log.event === "coordinate_update" && (
                            <span className="text-[10px] text-slate-500 ml-1.5">
                              (Lat shift: {log.details.lat_shift}, Lng shift: {log.details.lng_shift})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-slate-500 text-xs italic text-center py-6 h-full flex items-center justify-center">
                    Listening for incoming shipment telemetry and Kafka events...
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: BUILD IMPACT SIMULATOR */}
        {activeTab === "simulator" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Top overview card */}
            {simResult && (
              <div className="glass-card rounded-2xl p-5 flex flex-col md:flex-row justify-between items-center gap-4 border-l-4 border-l-cyan-500 bg-gradient-to-r from-cyan-950/20 to-transparent">
                <div>
                  <h3 className="font-extrabold text-lg text-white">Project Launch Impact Assessment</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Adjust components delivery sliders on the left panel to test how delay events ripple down dependencies and shift downstream milestones. Red elements represent the Critical Path.
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0 bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total Timeline</span>
                    <span className="text-2xl font-black text-slate-100">{simResult.total_project_days} <span className="text-xs text-slate-400">days</span></span>
                  </div>
                  <div className="w-px h-10 bg-slate-800" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Launch Date</span>
                    <span className="text-xl font-extrabold text-cyan-400">{simResult.project_launch_date}</span>
                  </div>
                  <div className="w-px h-10 bg-slate-800" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Timeline Slip</span>
                    <span className={`text-xl font-extrabold ${simResult.project_delay_days > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                      +{simResult.project_delay_days} days
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sliders sidebar (1/3 width) */}
              <div className="glass-card rounded-2xl p-5 flex flex-col min-h-[450px]">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-bold text-sm tracking-wide uppercase">Inject Timeline Delays</h4>
                  </div>
                  <button 
                    onClick={resetSimulator}
                    className="text-[10px] bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold px-2.5 py-1 rounded"
                  >
                    Reset Overrides
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[420px] pr-2 flex flex-col gap-4">
                  {shipments.map((s) => {
                    const currentOverride = manualDelays[s.component_id] || 0;
                    return (
                      <div key={s.id} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs text-slate-100">{s.component_name}</span>
                          <span className={`text-[10px] font-extrabold ${currentOverride > 0 ? "text-rose-400" : "text-slate-500"}`}>
                            {currentOverride > 0 ? `+${currentOverride}d Override` : "0d base"}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="180"
                          value={currentOverride}
                          onChange={(e) => handleSliderChange(s.component_id, parseInt(e.target.value))}
                          className="w-full accent-cyan-500 cursor-ew-resize bg-slate-800 h-1 rounded"
                        />
                        <div className="flex justify-between text-[8px] text-slate-500 font-semibold tracking-widest uppercase">
                          <span>0 days</span>
                          <span>In Transit: +{s.expected_delay_days}d</span>
                          <span>180 days</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gantt Timeline Chart (2/3 width) */}
              <div className="glass-card rounded-2xl p-5 lg:col-span-2 flex flex-col justify-between min-h-[450px]">
                <div>
                  <h4 className="font-bold text-sm tracking-wide uppercase mb-4">Construction & Sourcing Sequence Gantt</h4>
                  
                  {loadingSim ? (
                    <div className="flex flex-col gap-3 py-10 items-center justify-center h-full">
                      <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                      <span className="text-xs text-slate-400 mt-2">Recalculating Critical Path CPM...</span>
                    </div>
                  ) : simResult && (
                    <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-2">
                      
                      {/* Timeline Day Markers Header */}
                      <div className="flex text-[10px] text-slate-500 font-bold border-b border-slate-900 pb-1 mb-1">
                        <div className="w-1/3 shrink-0">Stage Milestone</div>
                        <div className="flex-1 flex justify-between relative pl-2">
                          <span>Day 0</span>
                          <span>120</span>
                          <span>240</span>
                          <span>360</span>
                          <span className="text-cyan-400 font-black">Day {simResult.total_project_days}</span>
                        </div>
                      </div>

                      {/* Timeline Rows */}
                      {simResult.critical_path.map((item) => {
                        const totalWidth = simResult.total_project_days || 1;
                        const leftPct = (item.start_day / totalWidth) * 100;
                        const widthPct = (item.duration_days / totalWidth) * 100;
                        
                        return (
                          <div key={item.component_id} className="flex items-center text-xs h-7 hover:bg-slate-900/40 rounded px-1">
                            {/* Milestone Name */}
                            <div className="w-1/3 shrink-0 truncate pr-3 flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.is_critical ? "bg-rose-500 animate-pulse" : "bg-cyan-500"}`} />
                              <span className={`font-semibold ${item.is_critical ? "text-rose-300" : "text-slate-300"}`}>
                                {item.name}
                              </span>
                            </div>

                            {/* Gantt Bar Lane */}
                            <div className="flex-1 h-3 bg-slate-950/60 rounded-full relative overflow-hidden pl-2">
                              {/* Horizontal scheduling bar */}
                              <div 
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                className={`absolute h-full rounded-full ${
                                  item.is_critical 
                                    ? "bg-gradient-to-r from-rose-500 to-rose-600 glow-rose" 
                                    : "bg-gradient-to-r from-cyan-500 to-indigo-600"
                                }`}
                              />
                            </div>

                            {/* Bar Stats text */}
                            <div className="w-16 text-right text-[10px] font-bold text-slate-400 shrink-0">
                              Day {item.start_day}-{item.end_day}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-900 flex justify-between items-center text-[10px] text-slate-500 font-medium">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-rose-500 inline-block rounded" /> Critical Path</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-1 bg-cyan-500 inline-block rounded" /> Non-critical Phase</span>
                  </div>
                  <span>CPM sensitivity analysis matches pre-seeded task dependencies.</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: MULTI-COUNTRY SUPPLIER OPTIMIZER */}
        {activeTab === "optimizer" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            
            {/* Sourcing Optimizer Header controls */}
            <div className="glass-card rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="font-extrabold text-lg text-white">Multi-Country Sourcing Recommendation Optimizer</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Re-score backup global suppliers by adjusting priorities on the dynamic sliders below.
                </p>
              </div>

              {/* Category dropdown */}
              <div className="flex items-center gap-3 bg-[#0d122b] border border-slate-800 rounded-xl px-4 py-2 text-sm">
                <span className="text-slate-400 font-medium">Evaluate Component:</span>
                <select 
                  value={optCategory}
                  onChange={(e) => setOptCategory(e.target.value)}
                  className="bg-transparent font-bold text-cyan-400 focus:outline-none border-none cursor-pointer"
                >
                  <option value="Transformer">High-Voltage Transformers</option>
                  <option value="GPU">NVIDIA H100 GPU Racks</option>
                  <option value="Switchgear">Medium-Voltage Switchgear</option>
                  <option value="Chiller">Chillers & Cooling Towers</option>
                  <option value="UPS">Industrial UPS Systems</option>
                </select>
              </div>
            </div>

            {/* Slider Controls & Recommendations results */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Sliders block (1/3 width) */}
              <div className="glass-card rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-sm tracking-wide uppercase">Adjustment Weightings</h4>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Cost weight */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <DollarSign className="w-3.5 h-3.5 text-cyan-400" /> Procurement Unit Cost
                      </span>
                      <span className="font-bold text-cyan-400">{weightCost}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={weightCost} 
                      onChange={(e) => setWeightCost(parseInt(e.target.value))}
                      className="accent-cyan-500 h-1 bg-slate-800 rounded"
                    />
                  </div>

                  {/* Lead Time weight */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" /> Fabrication Cycle Days
                      </span>
                      <span className="font-bold text-cyan-400">{weightTime}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={weightTime} 
                      onChange={(e) => setWeightTime(parseInt(e.target.value))}
                      className="accent-cyan-500 h-1 bg-slate-800 rounded"
                    />
                  </div>

                  {/* Delay Risk weight */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" /> Logistics Sourcing Risk
                      </span>
                      <span className="font-bold text-cyan-400">{weightRisk}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={weightRisk} 
                      onChange={(e) => setWeightRisk(parseInt(e.target.value))}
                      className="accent-cyan-500 h-1 bg-slate-800 rounded"
                    />
                  </div>

                  {/* Carbon footprint weight */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <Leaf className="w-3.5 h-3.5 text-cyan-400" /> CO2 Carbon Footprint
                      </span>
                      <span className="font-bold text-cyan-400">{weightCarbon}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={weightCarbon} 
                      onChange={(e) => setWeightCarbon(parseInt(e.target.value))}
                      className="accent-cyan-500 h-1 bg-slate-800 rounded"
                    />
                  </div>

                  {/* Tariffs weight */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-300 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-cyan-400" /> Border Customs & Tariffs
                      </span>
                      <span className="font-bold text-cyan-400">{weightTariff}%</span>
                    </div>
                    <input 
                      type="range" min="0" max="100" value={weightTariff} 
                      onChange={(e) => setWeightTariff(parseInt(e.target.value))}
                      className="accent-cyan-500 h-1 bg-slate-800 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Recommendations list (2/3 width) */}
              <div className="glass-card rounded-2xl p-5 lg:col-span-2 flex flex-col min-h-[450px]">
                <h4 className="font-bold text-sm tracking-wide uppercase mb-4">Optimized Supplier Rankings</h4>

                {loadingOpt ? (
                  <div className="flex flex-col gap-3 py-10 items-center justify-center h-full">
                    <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
                    <span className="text-xs text-slate-400 mt-2">Computing recommendation indices...</span>
                  </div>
                ) : optResult && (
                  <div className="flex flex-col gap-4">
                    
                    {/* Active supplier info card */}
                    {optResult.current_supplier && (
                      <div className="p-3 bg-[#131215] border border-dashed border-rose-950/40 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <span className="text-rose-400 font-bold block uppercase text-[8px] tracking-wider">Active Sourcing Contract</span>
                          <span className="font-extrabold text-slate-100 text-sm mt-0.5">{optResult.current_supplier.name}</span>
                          <span className="text-slate-400 block mt-0.5">Country: {optResult.current_supplier.country} | Base Lead time: {optResult.current_supplier.lead_time_days} days</span>
                        </div>
                        <span className="bg-rose-500/15 text-rose-300 border border-rose-500/20 px-3 py-1 rounded-full font-bold uppercase text-[9px]">
                          Risk Identified
                        </span>
                      </div>
                    )}

                    {/* Ranked candidates list */}
                    <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-2">
                      {optResult.recommendations.map((rec, index) => {
                        const isCurrent = optResult.current_supplier?.id === rec.supplier.id;
                        
                        return (
                          <div 
                            key={rec.supplier.id}
                            className={`p-4 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                              index === 0 
                                ? "bg-gradient-to-r from-cyan-950/20 to-transparent border-cyan-500/35 glow-cyan" 
                                : "bg-slate-950/40 border-slate-900 hover:border-slate-800"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-black ${
                                  index === 0 ? "bg-cyan-400" : "bg-slate-800 text-slate-400"
                                }`}>
                                  {index + 1}
                                </span>
                                <h5 className="font-extrabold text-sm text-slate-100">{rec.supplier.name}</h5>
                                <span className="text-slate-500 text-[10px] font-medium block">({rec.supplier.country})</span>
                              </div>

                              <div className="grid grid-cols-4 gap-3 text-[10px] text-slate-400 font-semibold uppercase tracking-wide mt-2">
                                <div>
                                  Cost: <span className="text-slate-200 font-bold block">${rec.estimated_cost_usd >= 1e6 ? `${(rec.estimated_cost_usd / 1e6).toFixed(2)}M` : `${(rec.estimated_cost_usd / 1e3).toFixed(0)}k`}</span>
                                </div>
                                <div>
                                  Time: <span className="text-slate-200 font-bold block">{rec.estimated_lead_time_days} days</span>
                                </div>
                                <div>
                                  Carbon: <span className="text-slate-200 font-bold block">{rec.carbon_footprint_co2}t CO2</span>
                                </div>
                                <div>
                                  Tariff: <span className="text-slate-200 font-bold block">{rec.tariff_exposure_pct}%</span>
                                </div>
                              </div>

                              {/* Pros & Cons list badges */}
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {rec.pros.map((pro, idx) => (
                                  <span key={idx} className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-2 h-2 text-emerald-400" />
                                    {pro}
                                  </span>
                                ))}
                                {rec.cons.map((con, idx) => (
                                  <span key={idx} className="bg-rose-500/10 text-rose-300 border border-rose-500/15 text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-2 h-2 text-rose-400" />
                                    {con}
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Optimization Score */}
                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Score Index</span>
                              <span className={`text-xl font-black ${
                                index === 0 ? "text-cyan-400" : "text-slate-100"
                              }`}>{rec.score}%</span>
                              {isCurrent && (
                                <span className="text-[8px] text-slate-500 font-extrabold uppercase mt-1">Current Source</span>
                              )}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 4: AI PROCUREMENT COPILOT PANEL */}
        {activeTab === "copilot" && (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-[460px] animate-fadeIn">
            
            {/* Chat console (2/3 width) */}
            <div className="glass-card rounded-2xl p-5 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-sm tracking-wide uppercase">AI Procurement Copilot</h3>
                  </div>
                  <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2.5 py-0.5 rounded uppercase font-black">
                    RAG-indexed
                  </span>
                </div>

                {/* Preset Suggestions buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button 
                    onClick={() => handlePresetQuery("Which components are most likely to delay our Dallas AI data center?")}
                    className="text-[10px] bg-slate-950 border border-slate-900 hover:border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-1.5 px-3 rounded-xl"
                  >
                    "Dallas AI-1 bottleneck delays?"
                  </button>
                  <button 
                    onClick={() => handlePresetQuery("Find a lower-risk supplier for 20MW transformer capacity.")}
                    className="text-[10px] bg-slate-950 border border-slate-900 hover:border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-1.5 px-3 rounded-xl"
                  >
                    "Alternate 20MW transformer source?"
                  </button>
                  <button 
                    onClick={() => handlePresetQuery("What happens if Taiwan GPU shipment is delayed by 3 weeks?")}
                    className="text-[10px] bg-slate-950 border border-slate-900 hover:border-slate-800 hover:bg-slate-900 text-slate-300 font-bold py-1.5 px-3 rounded-xl"
                  >
                    "Taiwan GPU 3-week delay impact?"
                  </button>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 bg-[#03050b] rounded-xl border border-slate-900 p-4 overflow-y-auto max-h-[300px] flex flex-col gap-4 mb-4">
                {chatLog.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex gap-3 text-xs max-w-[85%] chat-message-anim ${
                      msg.sender === "user" ? "self-end flex-row-reverse" : "self-start"
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.sender === "user" ? "bg-indigo-600 text-white" : "bg-cyan-500 text-black glow-cyan"
                    }`}>
                      {msg.sender === "user" ? <User className="w-3.5 h-3.5" /> : <Cpu className="w-3.5 h-3.5" />}
                    </div>

                    {/* Bubble */}
                    <div className={`p-3.5 rounded-2xl ${
                      msg.sender === "user" 
                        ? "bg-[#1d233c] border border-slate-800 rounded-tr-none text-slate-200" 
                        : "bg-slate-900/60 border border-slate-850 rounded-tl-none text-slate-300"
                    }`}>
                      {/* Response text formatted with breaks */}
                      <p className="whitespace-pre-line leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {/* Loading indicator */}
                {loadingChat && (
                  <div className="flex gap-3 text-xs self-start">
                    <div className="w-7 h-7 rounded-full bg-cyan-500 text-black flex items-center justify-center animate-pulse">
                      <Cpu className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-2xl rounded-tl-none text-slate-400 italic flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      <span>Reading legal contracts and SLAs...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input Console form */}
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChatMessage(chatInput);
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Ask a supply chain query (e.g. Find alternative routes for Italy switchgear)..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-900 hover:border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs focus:outline-none text-slate-100 placeholder:text-slate-600 transition-colors"
                />
                <button
                  type="submit"
                  disabled={loadingChat || !chatInput.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black p-3 rounded-xl disabled:opacity-40 disabled:hover:bg-cyan-500 font-bold transition-all shrink-0 flex items-center justify-center shadow-lg"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* RAG Citation index side pane (1/3 width) */}
            <div className="glass-card rounded-2xl p-5 lg:w-80 flex flex-col justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h4 className="font-bold text-sm tracking-wide uppercase">Source Citations (RAG)</h4>
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[320px] pr-2">
                  {/* Pull active chat response's citations */}
                  {(() => {
                    // Get latest copilot message with citations
                    const copilotMsgs = chatLog.filter(m => m.sender === "copilot" && m.citations && m.citations.length > 0);
                    if (copilotMsgs.length === 0) {
                      return (
                        <div className="text-slate-500 text-[10px] italic py-6 text-center">
                          No active citations retrieved. Submit a query to search the contracts database.
                        </div>
                      );
                    }
                    
                    const latestMsg = copilotMsgs[copilotMsgs.length - 1];
                    return latestMsg.citations?.map((c, idx) => (
                      <div key={idx} className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex flex-col gap-1.5">
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-[10px] text-cyan-400 truncate max-w-[150px]">{c.title}</span>
                          <span className="bg-slate-900 border border-slate-850 px-1.5 py-0.5 rounded text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                            {c.category}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-normal line-clamp-4 italic border-l border-slate-800 pl-2">
                          "{c.snippet}"
                        </p>
                        <span className="text-[8px] text-slate-500 text-right mt-1">Relevance Score: {int(c.relevance_score * 100)}%</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              <div className="bg-[#03050b] rounded-xl p-3 border border-slate-900 text-[9px] text-slate-500 leading-relaxed mt-4">
                The AI Procurement Copilot semantic search indexes contracts, logistics SLA guidelines, and USMCA tariff bulletins.
              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-[#03050b]/80 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-slate-500 font-semibold tracking-wide mt-12">
        <span>© {new Date().getFullYear()} SECURESYNC INC. ALL RIGHTS RESERVED.</span>
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            TELEMETRY: ONLINE
          </span>
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-cyan-500" />
            PROCURING FOR: DALLAS AI-1
          </span>
        </div>
      </footer>

    </div>
  );
}

// Utility helper to cast numbers to integers
function int(val: number): number {
  return Math.round(val);
}
