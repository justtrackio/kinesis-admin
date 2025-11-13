import React from 'react';
import { Card, Typography, Descriptions, Spin, Alert, Table, Form, Input, Button, notification, Popconfirm, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiBaseUrl } from './config';

interface Props { name: string; }
interface StreamDescription {
  streamName: string;
  streamArn: string;
  status: string;
  retentionHours: number;
  shardCount: number;
  encryptionType?: string;
}

interface StreamMessagesResponse {
  records: Array<{
    shardId: string;
    partitionKey: string;
    sequenceNumber: string;
    approximateArrivalTimestamp?: string;
    dataBase64: string;
  }>;
  count: number;
  shards: number;
}

const fetchDescription = async (name: string): Promise<StreamDescription> => {
  const res = await fetch(`${apiBaseUrl}/stream/describe?streamName=${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const fetchMessages = async (name: string): Promise<StreamMessagesResponse> => {
  const res = await fetch(`${apiBaseUrl}/stream/messages?streamName=${encodeURIComponent(name)}&limit=40`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const StreamOverview: React.FC<Props> = ({ name }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery<StreamDescription, Error>({
    queryKey: ['stream', name],
    queryFn: () => fetchDescription(name),
    staleTime: 30_000,
  });

  const { data: messages, isLoading: loadingMsg, isError: errorMsg, error: msgError } = useQuery<StreamMessagesResponse, Error>({
    queryKey: ['stream-messages', name],
    queryFn: () => fetchMessages(name),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const deleteMutation = useMutation<{ status: string; stream: string }, Error, string>({
    mutationFn: async (streamName: string) => {
      const res = await fetch(`${apiBaseUrl}/stream`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamName }),
      });
      if (!res.ok) throw new Error(`Delete failed HTTP ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      message.success('Stream deleted');
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      navigate('/');
    },
    onError: (e) => {
      message.error(e.message);
    },
  });

  return (
    <Card
      title={`Stream: ${name}`}
      extra={
        <Popconfirm
          title={`Delete stream '${name}'?`}
          okText="Delete"
          okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          onConfirm={() => deleteMutation.mutate(name)}
        >
          <Button danger disabled={deleteMutation.isPending}>Delete Stream</Button>
        </Popconfirm>
      }
    >
      {isLoading && <Spin />}
      {isError && <Alert type="error" message="Failed to load stream" description={error.message} />}
      {data && (
        <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="ARN"><Typography.Text copyable>{data.streamArn}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="Status">{data.status}</Descriptions.Item>
          <Descriptions.Item label="Retention (h)">{data.retentionHours}</Descriptions.Item>
          <Descriptions.Item label="Shards">{data.shardCount}</Descriptions.Item>
          <Descriptions.Item label="Encryption">{data.encryptionType || 'None'}</Descriptions.Item>
        </Descriptions>
      )}

      <Typography.Title level={5}>Latest Messages {messages ? `(${messages.count})` : ''}</Typography.Title>
      {loadingMsg && <Spin />}
      {errorMsg && <Alert type="error" message="Failed to load messages" description={msgError.message} />}
      {messages && (
        <Table
          dataSource={(messages?.records || []).map((r, idx) => ({ key: idx, ...r }))}
          size="small"
          bordered
          pagination={false}
          scroll={{ y: 300 }}
          locale={{ emptyText: 'No recent messages' }}
          columns={[
            { title: 'Shard', dataIndex: 'shardId', width: 90 },
            { title: 'Partition Key', dataIndex: 'partitionKey', width: 160 },
            { title: 'Seq', dataIndex: 'sequenceNumber', render: (v: string) => <Typography.Text style={{ fontSize: 12 }} copyable>{v}</Typography.Text> },
            { title: 'Arrival', dataIndex: 'approximateArrivalTimestamp', width: 140 },
            { title: 'Data', dataIndex: 'dataBase64', render: (v: string) => {
              return <Typography.Text style={{ fontFamily: 'monospace' }}>{v}</Typography.Text>;
            } },
          ]}
        />
      )}

      <Card title="Publish Message" size="small" style={{ marginTop: 16 }}>
        {data && <PublishMessageForm streamArn={data.streamArn} streamName={name} />}
      </Card>
    </Card>
  );
};

interface PublishFormValues {
  data: string;
  partitionKey?: string;
}

const PublishMessageForm: React.FC<{ streamArn: string; streamName: string }> = ({ streamArn, streamName }) => {
  const [form] = Form.useForm<PublishFormValues>();
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, Error, PublishFormValues>({
    mutationFn: (values) => {
      return fetch(`${apiBaseUrl}/stream/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, streamArn }),
      }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
    },
    onSuccess: () => {
      notification.success({ message: 'Message published' });
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['stream-messages', streamName] });
    },
    onError: (error) => {
      notification.error({ message: 'Publish failed', description: error.message });
    }
  });

  return (
    <Form form={form} onFinish={mutation.mutate} layout="vertical">
      <Form.Item name="data" label="Data" rules={[{ required: true }]}>
        <Input.TextArea rows={3} placeholder='{"foo":"bar"}' />
      </Form.Item>
      <Form.Item name="partitionKey" label="Partition Key (optional)">
        <Input placeholder="Defaults to a random UUID" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" loading={mutation.isPending}>Publish</Button>
      </Form.Item>
    </Form>
  );
};
