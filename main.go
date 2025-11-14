package main

import (
	"context"
	"embed"
	_ "embed"

	"github.com/gin-contrib/cors"
	"github.com/gosoline-project/httpserver"
	"github.com/justtrackio/gosoline/pkg/application"
	"github.com/justtrackio/gosoline/pkg/cfg"
	"github.com/justtrackio/gosoline/pkg/log"
)

//go:embed config.dist.yml
var configDist []byte

//go:embed frontend/dist
var frontend embed.FS

func main() {
	application.New(
		application.WithConfigDebug,
		application.WithConfigBytes(configDist, "yml"),
		application.WithConfigEnvKeyReplacer(cfg.DefaultEnvKeyReplacer),
		application.WithConfigSanitizers(cfg.TimeSanitizer),
		application.WithLoggerHandlersFromConfig,
		application.WithUTCClock(true),
		application.WithModuleFactory("http", httpserver.NewServer("default", func(ctx context.Context, config cfg.Config, logger log.Logger, router *httpserver.Router) error {
			router.Use(cors.Default())
			router.UseFactory(httpserver.CreateEmbeddedStaticServe(frontend, "frontend/dist", "/api"))

			router.Group("/api").HandleWith(httpserver.With(NewKinesisHandler, func(router *httpserver.Router, handler *KinesisHandler) {
				router.GET("/list", httpserver.BindN(handler.ListStreams))
				router.DELETE("/stream", httpserver.Bind(handler.DeleteStream))
				router.POST("/stream/message", httpserver.Bind(handler.PublishMessage))
				router.GET("/stream/describe", httpserver.Bind(handler.DescribeStream))
				router.GET("/stream/messages", httpserver.Bind(handler.LatestMessages))
			}))

			return nil
		})),
	).Run()
}
