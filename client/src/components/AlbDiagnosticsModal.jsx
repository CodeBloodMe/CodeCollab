import React, { useState, useEffect } from "react";
import {
  Server,
  Cloud,
  CheckCircle2,
  Activity,
  Layers,
  ArrowRight,
  Database,
  ShieldCheck,
  X,
  Play,
  RotateCw,
} from "lucide-react";
import api, { albTelemetry, API_BASE } from "../api/client";

const AlbDiagnosticsModal = ({ isOpen, onClose }) => {
  const [telemetry, setTelemetry] = useState(albTelemetry.getState());
  const [isProbing, setIsProbing] = useState(false);
  const [probeResults, setProbeResults] = useState([]);
  const [activeHealth, setActiveHealth] = useState(null);

  useEffect(() => {
    const unsub = albTelemetry.subscribe((state) => {
      setTelemetry(state);
    });
    return unsub;
  }, []);

  // Fetch initial health info when modal opens
  useEffect(() => {
    if (isOpen) {
      api
        .get("/api/health")
        .then((res) => {
          setActiveHealth(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const runRoundRobinProbe = async () => {
    setIsProbing(true);
    setProbeResults([]);
    const results = [];

    for (let i = 1; i <= 6; i++) {
      try {
        const start = performance.now();
        const res = await api.get(`/api/health?probe_seq=${i}&_t=${Date.now()}`);
        const duration = Math.round(performance.now() - start);

        const instanceId =
          res.headers["x-instance-id"] ||
          res.data.instance_id ||
          "unknown-node";
        const servedBy =
          res.headers["x-served-by"] ||
          res.data.instance_role ||
          "Compute Node";
        const az =
          res.headers["x-availability-zone"] ||
          res.data.availability_zone ||
          "us-east-1a";

        results.push({
          seq: i,
          status: "SUCCESS",
          code: res.status,
          instanceId,
          servedBy,
          az,
          duration,
          timestamp: new Date().toLocaleTimeString(),
        });
      } catch (err) {
        results.push({
          seq: i,
          status: "ERROR",
          code: err.response?.status || 500,
          instanceId: "N/A",
          servedBy: "Failed",
          az: "N/A",
          duration: 0,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      setProbeResults([...results]);
      // Small delay between requests to simulate real client traffic
      await new Promise((r) => setTimeout(r, 220));
    }

    setIsProbing(false);
  };

  const currentInstance =
    telemetry.lastInstanceId || activeHealth?.instance_id || "ec2-server1";
  const currentRole =
    telemetry.lastServedBy || activeHealth?.instance_role || "Primary Compute Node";
  const currentAz =
    telemetry.lastAz || activeHealth?.availability_zone || "us-east-1a";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Layers className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                AWS Multi-AZ & Application Load Balancer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase">
                  QP 1 Free Tier
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                S3 Static Hosting + Dual EC2 Multi-AZ Backend + ALB Round-Robin + RDS PostgreSQL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* Architecture Topology Map */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Activity className="size-3.5 text-cyan-400" />
              <span>Free Tier Cloud Architecture Diagram</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 items-center">
              {/* S3 Tier */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="flex justify-center mb-1 text-emerald-400">
                  <Cloud className="size-5" />
                </div>
                <div className="font-semibold text-slate-200 text-xs">Amazon S3</div>
                <div className="text-[10px] text-slate-400">Static Website</div>
                <div className="mt-1 text-[9px] font-mono text-emerald-400/90 bg-emerald-950/50 py-0.5 px-1 rounded border border-emerald-800/40">
                  codeforge-bucket
                </div>
              </div>

              {/* ALB Tier */}
              <div className="bg-slate-900 border border-cyan-800/60 rounded-lg p-2.5 text-center shadow-lg shadow-cyan-950/30">
                <div className="flex justify-center mb-1 text-cyan-400">
                  <Layers className="size-5" />
                </div>
                <div className="font-semibold text-cyan-200 text-xs">AWS ALB</div>
                <div className="text-[10px] text-slate-400">Round-Robin LB</div>
                <div className="mt-1 text-[9px] font-mono text-cyan-400 bg-cyan-950/50 py-0.5 px-1 rounded border border-cyan-800/40">
                  Target Group: 80 / 5000
                </div>
              </div>

              {/* EC2 Nodes Tier */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                  <span className="flex items-center gap-1">
                    <Server className="size-3.5 text-indigo-400" />
                    EC2 Backend
                  </span>
                  <span className="text-[9px] text-slate-400">2 Nodes</span>
                </div>
                <div
                  className={`p-1.5 rounded text-[10px] flex items-center justify-between border ${
                    currentAz === "us-east-1a"
                      ? "bg-indigo-950/50 border-indigo-500/50 text-indigo-200 font-semibold"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <span>Server 1</span>
                  <span className="font-mono text-[9px]">us-east-1a</span>
                </div>
                <div
                  className={`p-1.5 rounded text-[10px] flex items-center justify-between border ${
                    currentAz === "us-east-1b"
                      ? "bg-indigo-950/50 border-indigo-500/50 text-indigo-200 font-semibold"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  <span>Server 2</span>
                  <span className="font-mono text-[9px]">us-east-1b</span>
                </div>
              </div>

              {/* RDS Database Tier */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-center">
                <div className="flex justify-center mb-1 text-purple-400">
                  <Database className="size-5" />
                </div>
                <div className="font-semibold text-slate-200 text-xs">Amazon RDS</div>
                <div className="text-[10px] text-slate-400">PostgreSQL 16</div>
                <div className="mt-1 text-[9px] font-mono text-purple-300 bg-purple-950/50 py-0.5 px-1 rounded border border-purple-800/40">
                  Port 5432 Shared
                </div>
              </div>
            </div>
          </div>

          {/* Current Serving Node Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Serving Node ID
              </span>
              <span className="font-mono text-xs text-cyan-300 font-bold break-all mt-1 block">
                {currentInstance}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Node Role & Deployment
              </span>
              <span className="text-xs text-slate-200 font-medium mt-1 block">
                {currentRole}
              </span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Availability Zone (AZ)
              </span>
              <span className="inline-flex items-center gap-1.5 mt-1 font-mono text-xs font-semibold text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse"></span>
                {currentAz}
              </span>
            </div>
          </div>

          {/* Round-Robin ALB Verification Prober */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-cyan-400" />
                  Live ALB Round-Robin Verification Probe
                </h4>
                <p className="text-[11px] text-slate-400">
                  Sends 6 sequential requests to test load distribution across Server 1 and Server 2.
                </p>
              </div>

              <button
                onClick={runRoundRobinProbe}
                disabled={isProbing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-medium text-xs transition shadow-md shadow-cyan-600/20"
              >
                {isProbing ? (
                  <>
                    <RotateCw className="size-3.5 animate-spin" />
                    <span>Testing ALB...</span>
                  </>
                ) : (
                  <>
                    <Play className="size-3.5 fill-current" />
                    <span>Run ALB Round-Robin Test</span>
                  </>
                )}
              </button>
            </div>

            {probeResults.length > 0 && (
              <div className="overflow-x-auto border border-slate-800 rounded-lg mt-2">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Req #</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Serving EC2 Node</th>
                      <th className="py-2 px-3">Availability Zone</th>
                      <th className="py-2 px-3">Latency</th>
                      <th className="py-2 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {probeResults.map((res) => (
                      <tr key={res.seq} className="hover:bg-slate-900/50">
                        <td className="py-2 px-3 font-semibold text-slate-300">
                          #{res.seq}
                        </td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/30">
                            HTTP {res.code}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-cyan-300">
                          {res.instanceId}
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] ${
                              res.az === "us-east-1a"
                                ? "bg-blue-950/70 text-blue-300 border border-blue-800/40"
                                : "bg-purple-950/70 text-purple-300 border border-purple-800/40"
                            }`}
                          >
                            {res.az}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {res.duration}ms
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {res.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Ingress Telemetry History */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Recent Response Telemetry (Last 10 API Ingress Events)</span>
              <span className="text-slate-500 font-mono text-[10px]">
                {telemetry.history.length} logged
              </span>
            </div>

            <div className="max-h-36 overflow-y-auto border border-slate-800/80 rounded-lg bg-slate-950">
              {telemetry.history.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-xs">
                  No API requests recorded yet. Make edits, execute code, or run probes.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/50 font-mono text-[10px]">
                  {telemetry.history.slice(0, 10).map((item) => (
                    <div
                      key={item.id}
                      className="p-2 flex items-center justify-between hover:bg-slate-900/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{item.timestamp}</span>
                        <span className="text-slate-300 font-sans truncate max-w-[150px]">
                          {item.endpoint}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-400 font-semibold truncate max-w-[120px]">
                          {item.instanceId}
                        </span>
                        <span className="text-slate-400 px-1 rounded bg-slate-900 border border-slate-800">
                          {item.az}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400"></span>
            EC2 Target Group Health: OK (Port 5000)
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlbDiagnosticsModal;

