import React, { useState } from "react";
import { Form, Input, Button, Tabs, message as antdMessage, Dropdown, Menu } from "antd";
import { login, register } from "../api/auth";
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("login");
  const { t, i18n } = useTranslation();
  const [langMenuVisible, setLangMenuVisible] = useState(false);

  const onLogin = async (values: any) => {
    setLoading(true);
    try {
      const res = await login(values);
      localStorage.setItem("token", res.access_token);
      antdMessage.success(t('login_success'));
      window.location.href = "/";
    } catch {
      antdMessage.error(t('login_fail'));
    }
    setLoading(false);
  };

  const onRegister = async (values: any) => {
    setLoading(true);
    try {
      await register(values);
      antdMessage.success(t('register_success'));
      setTab("login");
    } catch (err: any) {
      // 处理邮箱已存在的情况
      console.log('[REGISTER ERROR]', err);
      const msg = err?.response?.data?.detail || err?.message || '';
      const status = err?.response?.status;
      const errStr = (typeof err === 'string' ? err : (err?.toString?.() || ''));
      if (
        (typeof msg === 'string' && msg.toLowerCase().includes('email') && msg.toLowerCase().includes('exist')) ||
        (status === 500 && typeof msg === 'string' && msg.includes('UNIQUE constraint failed: users.email')) ||
        (typeof errStr === 'string' && errStr.includes('UNIQUE constraint failed: users.email'))
      ) {
        antdMessage.error(t('email_exists'));
      } else {
        antdMessage.error(t('register_fail'));
      }
    }
    setLoading(false);
  };

  // 语言切换菜单
  const langMenu = (
    <Menu
      items={[
        { key: 'en', label: 'English', onClick: () => { i18n.changeLanguage('en'); setLangMenuVisible(false); } },
        { key: 'zh', label: '简体中文', onClick: () => { i18n.changeLanguage('zh'); setLangMenuVisible(false); } },
      ]}
    />
  );

  React.useEffect(() => {
    if (i18n.language !== 'en') {
      i18n.changeLanguage('en');
    }
    // eslint-disable-next-line
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <div style={{ position: 'fixed', right: 32, top: 32, zIndex: 10 }}>
        <Dropdown
          overlay={langMenu}
          trigger={["click"]}
          open={langMenuVisible}
          onOpenChange={setLangMenuVisible}
        >
          <Button icon={<GlobalOutlined />} shape="circle" />
        </Dropdown>
      </div>
      <div style={{ width: 360, background: "#fff", padding: 32, borderRadius: 8, boxShadow: "0 2px 8px #eee" }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          centered
          items={[
            {
              label: t('login'),
              key: 'login',
              children: (
                <Form onFinish={onLogin} layout="vertical">
                  <Form.Item name="username" label={t('username')} rules={[{ required: true, message: t('input_username') }]}> 
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label={t('password')} rules={[{ required: true, message: t('input_password') }]}> 
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>{t('login')}</Button>
                </Form>
              )
            },
            {
              label: t('register'),
              key: 'register',
              children: (
                <Form onFinish={onRegister} layout="vertical">
                  <Form.Item name="username" label={t('username')} rules={[{ required: true, message: t('input_username') }]}> 
                    <Input />
                  </Form.Item>
                  <Form.Item name="email" label={t('email')} rules={[{ required: true, type: "email", message: t('input_email') }]}> 
                    <Input />
                  </Form.Item>
                  <Form.Item name="password" label={t('password')} rules={[{ required: true, message: t('input_password') }]}> 
                    <Input.Password />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block loading={loading}>{t('register')}</Button>
                </Form>
              )
            }
          ]}
        />
      </div>
    </div>
  );
};

export default LoginPage; 