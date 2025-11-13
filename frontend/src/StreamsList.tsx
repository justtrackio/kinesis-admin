import React from 'react';
import { Table, Spin, Alert, Typography, Space, Button, Popconfirm, message, Modal } from 'antd';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl } from './config';

interface StreamsResponse {
  streams: string[];
  count: number;
}

const fetchStreams = async (): Promise<StreamsResponse> => {
  const res = await fetch(`${apiBaseUrl}/list`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export const StreamsList: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<StreamsResponse, Error>({
    queryKey: ['streams'],
    queryFn: fetchStreams,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation<{ status: string; stream: string }, Error, string, { prev?: StreamsResponse }>({
    mutationFn: async (streamName: string) => {
      const res = await fetch(`${apiBaseUrl}/stream`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamName }),
      });
      if (!res.ok) throw new Error(`Delete failed HTTP ${res.status}`);
      return res.json();
    },
    onMutate: async (streamName) => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const prev = queryClient.getQueryData<StreamsResponse>(['streams']);
      if (prev) {
        queryClient.setQueryData<StreamsResponse>(['streams'], {
          streams: prev.streams.filter(s => s !== streamName),
          count: prev.count - 1,
        });
      }
      return { prev };
    },
    onError: (e, _streamName, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['streams'], ctx.prev);
      message.error(e.message);
    },
    onSuccess: () => message.success('Stream deleted'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    },
  });

  if (isLoading) return <Spin />;
  if (isError) return <Alert type="error" message="Failed to load streams" description={error.message} />;
  if (!data) return null;

  const showDeleteAllConfirm = () => {
    Modal.confirm({
      title: 'Are you sure you want to delete all streams?',
      content: 'This action is irreversible.',
      okText: 'Delete All',
      okButtonProps: { danger: true },
      onOk: () => {
        return new Promise((resolve, reject) => {
          const streamsToDelete = data.streams;
          const promises = streamsToDelete.map(streamName => deleteMutation.mutateAsync(streamName));
          Promise.allSettled(promises).then(results => {
            const failed = results.filter(r => r.status === 'rejected');
            if (failed.length > 0) {
              message.error(`${failed.length} streams could not be deleted.`);
              reject();
            } else {
              message.success('All streams deleted successfully.');
              resolve(true);
            }
          });
        });
      },
    });
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Streams ({data.count})</Typography.Title>
        <Button danger onClick={showDeleteAllConfirm} disabled={!data?.streams?.length}>Delete All Streams</Button>
      </div>
      <Table
        size="small"
        bordered
        pagination={false}
        dataSource={(data?.streams || []).map(name => ({ key: name, name }))}
        columns={[
          { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <Link to={`/stream/${encodeURIComponent(v)}`} style={{ fontFamily: 'monospace' }}>{v}</Link> },
          {
            title: 'Actions', key: 'actions', width: 140,
            render: (_: any, record: { name: string }) => (
              <Popconfirm
                title={`Delete stream '${record.name}'?`}
                okText="Delete"
                okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
                onConfirm={() => deleteMutation.mutate(record.name)}
              >
                <Button danger size="small" disabled={deleteMutation.isPending}>Delete</Button>
              </Popconfirm>
            ),
          }
        ]}
        locale={{ emptyText: 'No streams found' }}
        rowKey="name"
      />
    </Space>
  );
};
