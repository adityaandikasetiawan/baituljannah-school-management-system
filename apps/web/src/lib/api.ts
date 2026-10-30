import axios from "axios";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000", timeout: 10000 });
api.interceptors.request.use((config) => { const token = sessionStorage.getItem("bj_access_token"); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
