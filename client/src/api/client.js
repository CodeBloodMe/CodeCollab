import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// AWS ALB Telemetry Store
export const albTelemetry = {
  lastInstanceId: null,
  lastServedBy: null,
  lastAz: null,
  history: [],
  listeners: new Set(),

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  },

  record(instanceId, servedBy, az, endpoint) {
    if (!instanceId) return;
    this.lastInstanceId = instanceId;
    this.lastServedBy = servedBy || instanceId;
    this.lastAz = az || "us-east-1a";

    this.history.unshift({
      id: Math.random().toString(36).slice(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      instanceId,
      servedBy: this.lastServedBy,
      az: this.lastAz,
      endpoint: endpoint || "/api",
    });

    if (this.history.length > 25) {
      this.history.pop();
    }

    this.listeners.forEach((fn) => {
      try {
        fn({
          lastInstanceId: this.lastInstanceId,
          lastServedBy: this.lastServedBy,
          lastAz: this.lastAz,
          history: [...this.history],
        });
      } catch (e) {
        console.error("Telemetry listener error:", e);
      }
    });
  },

  getState() {
    return {
      lastInstanceId: this.lastInstanceId,
      lastServedBy: this.lastServedBy,
      lastAz: this.lastAz,
      history: [...this.history],
    };
  },
};

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("codeforge_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => {
    const instId = res.headers["x-instance-id"];
    const servedBy = res.headers["x-served-by"];
    const az = res.headers["x-availability-zone"];
    if (instId) {
      albTelemetry.record(instId, servedBy, az, res.config?.url);
    }
    return res;
  },
  (err) => {
    if (err.response?.headers) {
      const instId = err.response.headers["x-instance-id"];
      const servedBy = err.response.headers["x-served-by"];
      const az = err.response.headers["x-availability-zone"];
      if (instId) {
        albTelemetry.record(instId, servedBy, az, err.config?.url);
      }
    }
    if (err.response && err.response.status === 401) {
      const url = err.config?.url || "";
      if (!url.includes("/api/auth/")) {
        localStorage.removeItem("codeforge_token");
        localStorage.removeItem("codeforge_user");
      }
    }
    return Promise.reject(err);
  }
);

export default api;
export { API_BASE };
