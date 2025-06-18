import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000", // Use absolute URL for backend
  timeout: 10000,
});

// 请求拦截器，自动加 token
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器，统一错误处理
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response && err.response.status === 401) {
      // 未登录或 token 失效
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default api; 