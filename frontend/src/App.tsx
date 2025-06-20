import React, { useEffect, useState } from "react";
import { Layout } from "antd";
import Sidebar from "./components/Sidebar";
import MainArea from "./components/MainArea";
import LoginPage from "./pages/Login";
import { BrowserRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import "antd/dist/reset.css";
import { getChatHistories } from "./api/chat";

const { Sider, Content } = Layout;

const ProtectedApp: React.FC = () => {
  const navigate = useNavigate();
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);
  const [histories, setHistories] = useState<any[]>([]);
  const [loadingHistories, setLoadingHistories] = useState(false);

  const fetchHistories = async () => {
    setLoadingHistories(true);
    try {
      const data = await getChatHistories();
      setHistories(data);
    } catch (e) {
      // 可选：全局提示
    }
    setLoadingHistories(false);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  useEffect(() => {
    fetchHistories();
  }, []);

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider width={280} style={{ background: "#fff", borderRight: "1px solid #eee" }}>
        <Sidebar
          selectedHistory={selectedHistory}
          setSelectedHistory={setSelectedHistory}
          histories={histories}
          fetchHistories={fetchHistories}
          loading={loadingHistories}
        />
      </Sider>
      <Layout>
        <Content style={{ background: "#f9f9f9" }}>
          <MainArea
            selectedHistory={selectedHistory}
            setSelectedHistory={setSelectedHistory}
            fetchHistories={fetchHistories}
          />
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
