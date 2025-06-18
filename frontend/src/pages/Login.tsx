import React, { useState } from "react";
import { Form, Input, Button, Tabs, message as antdMessage } from "antd";
import { login, register } from "../api/auth";

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await login(values);
      localStorage.setItem("token", res.access_token);
      antdMessage.success("登录成功");
      window.location.href = "/";
    } catch {
      antdMessage.error("登录失败，请检查用户名和密码");
    }
    setLoading(false);
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      await register(values);
      antdMessage.success("注册成功，请登录");
      setTab("login");
    } catch {
      antdMessage.error("注册失败，用户名或邮箱可能已存在");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <div style={{ width: 360, background: "#fff", padding: 32, borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
        <Tabs activeKey={tab} onChange={setTab} centered>
          <Tabs.TabPane tab="登录" key="login">
            <Form onFinish={onLogin} layout="vertical">
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
            </Form>
          </Tabs.TabPane>
          <Tabs.TabPane tab="注册" key="register">
            <Form onFinish={onRegister} layout="vertical">
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="email" label="邮箱" rules={[{ required: true, type: "email", message: "请输入有效邮箱" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: "请输入密码" }]}>
                <Input.Password />
              </Form.Item>
              <Button type="primary" htmlType="submit" block loading={loading}>注册</Button>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default LoginPage; 