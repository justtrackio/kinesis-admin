import React from 'react';
import { Layout, Typography, theme, Breadcrumb } from 'antd';
import { StreamsList } from './StreamsList';
import { Routes, Route, useParams, Link, useLocation } from 'react-router-dom';
import { StreamOverview } from './StreamOverview';
const { Header, Content } = Layout;

function StreamOverviewWrapper() {
  const { name } = useParams();
  return <StreamOverview name={name!} />;
}

export function App() {
  const { token } = theme.useToken();
  const location = useLocation();
  const items = [{ title: <Link to="/">Streams</Link> }];
  if (location.pathname.startsWith('/stream/')) {
    items.push({ title: decodeURIComponent(location.pathname.replace('/stream/', '')) });
  }
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: token.colorBgContainer }}>
        <Typography.Title level={3} style={{ margin: 0 }}>Kinesis Admin UI</Typography.Title>
      </Header>
      <Content style={{ padding: 24 }}>
        <Breadcrumb style={{ marginBottom: 16 }} items={items} />
        <Routes>
          <Route path="/" element={<StreamsList />} />
          <Route path="stream/:name" element={<StreamOverviewWrapper />} />
        </Routes>
      </Content>
    </Layout>
  );
}
export default App;