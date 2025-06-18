import React, { useEffect, useState } from "react";
import { Layout } from "antd";
import Sidebar from "./components/Sidebar";
import MainArea from "./components/MainArea";
import LoginPage from "./pages/Login";
import { BrowserRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import "antd/dist/reset.css";

const { Sider, Content } = Layout;

const ProtectedApp: React.FC = () => {
  const navigate = useNavigate();
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);
  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={280} style={{ background: "#fff", borderRight: "1px solid #eee" }}>
        <Sidebar selectedHistory={selectedHistory} setSelectedHistory={setSelectedHistory} />
      </Sider>
      <Layout>
        <Content style={{ background: "#f9f9f9" }}>
          <MainArea selectedHistory={selectedHistory} setSelectedHistory={setSelectedHistory} />
        </Content>
      </Layout>
    </Layout>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </Router>
  );
}

export default App;
