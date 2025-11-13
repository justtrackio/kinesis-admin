package main

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/kinesis"
	"github.com/gosoline-project/httpserver"
	"github.com/justtrackio/gosoline/pkg/cfg"
	gosoKinesis "github.com/justtrackio/gosoline/pkg/cloud/aws/kinesis"
	"github.com/justtrackio/gosoline/pkg/log"
	"github.com/justtrackio/gosoline/pkg/uuid"
)

type DeleteStreamInput struct {
	StreamName string `json:"streamName"`
}

type DescribeStreamInput struct {
	StreamName string `form:"streamName"`
}

type LatestMessagesInput struct {
	StreamName string `form:"streamName"`
	Limit      int    `form:"limit"`
}

type PublishMessageInput struct {
	StreamARN    string `json:"streamArn"`
	PartitionKey string `json:"partitionKey"`
	Data         string `json:"data"`
}

func NewKinesisHandler(ctx context.Context, config cfg.Config, logger log.Logger) (*KinesisHandler, error) {
	var err error
	var client gosoKinesis.Client

	if client, err = gosoKinesis.NewClient(ctx, config, logger, "default"); err != nil {
		return nil, err
	}

	return &KinesisHandler{
		client: client,
	}, nil
}

type KinesisHandler struct {
	client gosoKinesis.Client
}

// ListStreams returns all available Kinesis stream names, iterating through pagination until exhausted.
func (h *KinesisHandler) ListStreams(ctx context.Context) (httpserver.Response, error) {
	var all []string

	input := &kinesis.ListStreamsInput{}

	for {
		out, err := h.client.ListStreams(ctx, input)
		if err != nil {
			return nil, err
		}

		all = append(all, out.StreamNames...)

		if out.NextToken == nil {
			break
		}

		input.NextToken = out.NextToken
	}

	return httpserver.NewJsonResponse(map[string]any{
		"streams": all,
		"count":   len(all),
	}), nil
}

// DeleteStream deletes the given Kinesis stream.
func (h *KinesisHandler) DeleteStream(ctx context.Context, in *DeleteStreamInput) (httpserver.Response, error) {
	if in == nil || in.StreamName == "" {
		return nil, fmt.Errorf("streamName required")
	}

	if _, err := h.client.DeleteStream(ctx, &kinesis.DeleteStreamInput{StreamName: aws.String(in.StreamName)}); err != nil {
		return nil, err
	}
	return httpserver.NewJsonResponse(map[string]string{"status": "deleted", "stream": in.StreamName}), nil
}

// DescribeStream returns metadata for a specific stream.
func (h *KinesisHandler) DescribeStream(ctx context.Context, in *DescribeStreamInput) (httpserver.Response, error) {
	if in == nil || in.StreamName == "" {
		return nil, fmt.Errorf("streamName required")
	}

	desc, err := h.client.DescribeStream(ctx, &kinesis.DescribeStreamInput{StreamName: aws.String(in.StreamName)})
	if err != nil {
		return nil, err
	}

	return httpserver.NewJsonResponse(map[string]any{
		"streamName":     desc.StreamDescription.StreamName,
		"streamArn":      aws.ToString(desc.StreamDescription.StreamARN),
		"status":         desc.StreamDescription.StreamStatus,
		"retentionHours": desc.StreamDescription.RetentionPeriodHours,
		"shardCount":     len(desc.StreamDescription.Shards),
		"encryptionType": desc.StreamDescription.EncryptionType,
	}), nil
}

// LatestMessages returns recent messages from each shard using LATEST iterator.
// If any shard operation fails, the function aborts and returns the error immediately.
func (h *KinesisHandler) LatestMessages(ctx context.Context, in *LatestMessagesInput) (httpserver.Response, error) {
	if in == nil || in.StreamName == "" {
		return nil, fmt.Errorf("streamName required")
	}
	limit := in.Limit
	if limit <= 0 {
		limit = 50
	}
	desc, err := h.client.DescribeStream(ctx, &kinesis.DescribeStreamInput{StreamName: aws.String(in.StreamName)})
	if err != nil {
		return nil, err
	}
	shards := desc.StreamDescription.Shards
	if len(shards) == 0 {
		return httpserver.NewJsonResponse(map[string]any{"records": []any{}, "count": 0, "shards": 0}), nil
	}
	perShard := limit / len(shards)
	if perShard <= 0 {
		perShard = 1
	}
	var records []map[string]any
	for _, shard := range shards {
		itrOut, err := h.client.GetShardIterator(ctx, &kinesis.GetShardIteratorInput{
			StreamName:        aws.String(in.StreamName),
			ShardId:           shard.ShardId,
			ShardIteratorType: "TRIM_HORIZON",
		})
		if err != nil || itrOut.ShardIterator == nil {
			if err == nil { // iterator missing
				return nil, fmt.Errorf("missing shard iterator for shard %s", aws.ToString(shard.ShardId))
			}
			return nil, fmt.Errorf("get shard iterator failed for shard %s: %w", aws.ToString(shard.ShardId), err)
		}
		recOut, err := h.client.GetRecords(ctx, &kinesis.GetRecordsInput{ShardIterator: itrOut.ShardIterator})
		if err != nil {
			return nil, fmt.Errorf("get records failed for shard %s: %w", aws.ToString(shard.ShardId), err)
		}
		count := 0
		for _, r := range recOut.Records {
			if count >= perShard {
				break
			}
			records = append(records, map[string]any{
				"shardId":                     shard.ShardId,
				"partitionKey":                r.PartitionKey,
				"sequenceNumber":              r.SequenceNumber,
				"approximateArrivalTimestamp": r.ApproximateArrivalTimestamp,
				"dataBase64":                  string(r.Data),
			})
			count++
		}
	}
	return httpserver.NewJsonResponse(map[string]any{
		"records": records,
		"count":   len(records),
		"shards":  len(shards),
	}), nil
}

// PublishMessage puts a single record onto the stream.
func (h *KinesisHandler) PublishMessage(ctx context.Context, in *PublishMessageInput) (httpserver.Response, error) {
	if in == nil || in.StreamARN == "" || in.Data == "" {
		return nil, fmt.Errorf("streamArn and data are required")
	}

	if in.PartitionKey == "" {
		in.PartitionKey = uuid.New().NewV4()
	}

	out, err := h.client.PutRecord(ctx, &kinesis.PutRecordInput{
		StreamARN:    aws.String(in.StreamARN),
		PartitionKey: aws.String(in.PartitionKey),
		Data:         []byte(in.Data),
	})
	if err != nil {
		return nil, err
	}

	fmt.Println(out.ResultMetadata)

	return httpserver.NewJsonResponse(map[string]any{
		"shardId":        out.ShardId,
		"sequenceNumber": out.SequenceNumber,
		"partitionKey":   in.PartitionKey,
	}), nil
}
