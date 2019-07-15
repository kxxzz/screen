#include "screen_a.h"
#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>
#include <sleep.h>
#include <atomic.h>

#include <webby.h>



enum
{
    SCREEN_SyncSrvConn_MAX = 8
};





typedef struct SCREEN_SyncSrv
{
    struct WebbyServer* server;
    struct WebbyServerConfig config[1];
    void* memory;
    u32 memorySize;

    u32 connectionCount;
    struct WebbyConnection* connection[SCREEN_SyncSrvConn_MAX];
    thrd_t thrd;
    int64_t shutdown[1];
} SCREEN_SyncSrv;

static SCREEN_SyncSrv srv[1] = { 0 };







static void SCREEN_syncSrv_log(const char* text)
{
    printf("[debug] %s\n", text);
}




static int SCREEN_syncSrv_dispatch(struct WebbyConnection* conn)
{
    if (0 == strcmp("/foo", conn->request.uri))
    {
        WebbyBeginResponse(conn, 200, 14, NULL, 0);
        WebbyWrite(conn, "Hello, world!\n", 14);
        WebbyEndResponse(conn);
        return 0;
    }
    else if (0 == strcmp("/bar", conn->request.uri))
    {
        WebbyBeginResponse(conn, 200, -1, NULL, 0);
        WebbyWrite(conn, "Hello, world!\n", 14);
        WebbyWrite(conn, "Hello, world?\n", 14);
        WebbyEndResponse(conn);
        return 0;
    }
    else if (0 == strcmp(conn->request.uri, "/quit"))
    {
        WebbyBeginResponse(conn, 200, -1, NULL, 0);
        WebbyPrintf(conn, "Goodbye, cruel world\n");
        WebbyEndResponse(conn);
        return 0;
    }
    else
    {
        return 1;
    }
}






static int SCREEN_syncSrv_connect(struct WebbyConnection* conn)
{
    /* Allow websocket upgrades on /wstest */
    if (0 == strcmp(conn->request.uri, "/wstest") && srv->connectionCount < SCREEN_SyncSrvConn_MAX)
    {
        return 0;
    }
    else
    {
        return 1;
    }
}




static void SCREEN_syncSrv_connected(struct WebbyConnection* conn)
{
    printf("WebSocket connected\n");
    srv->connection[srv->connectionCount++] = conn;
}




static void SCREEN_syncSrv_closed(struct WebbyConnection* conn)
{
    printf("WebSocket closed\n");

    for (u32 i = 0; i < srv->connectionCount; i++)
    {
        if (srv->connection[i] == conn)
        {
            int remain = srv->connectionCount - i;
            memmove(srv->connection + i, srv->connection + i + 1, remain * sizeof(srv->connection[0]));
            --srv->connectionCount;
            break;
        }
    }
}




static int SCREEN_syncSrv_frame(struct WebbyConnection* conn, const struct WebbyWsFrame* frame)
{
    u32 i = 0;

    printf("WebSocket frame incoming\n");
    printf("  Frame OpCode: %d\n", frame->opcode);
    printf("  Final frame?: %s\n", (frame->flags & WEBBY_WSF_FIN) ? "yes" : "no");
    printf("  Masked?     : %s\n", (frame->flags & WEBBY_WSF_MASKED) ? "yes" : "no");
    printf("  Data Length : %d\n", (int)frame->payload_length);

    while (i < (u32)frame->payload_length)
    {
        unsigned char buffer[16];
        int remain = frame->payload_length - i;
        size_t read_size = remain > (int)sizeof(buffer) ? sizeof(buffer) : (size_t)remain;
        size_t k;

        printf("%08x ", (int)i);

        if (0 != WebbyRead(conn, buffer, read_size))
        {
            break;
        }
        for (k = 0; k < read_size; ++k)
        {
            printf("%02x ", buffer[k]);
        }
        for (k = read_size; k < 16; ++k)
        {
            printf("   ");
        }
        printf(" | ");
        for (k = 0; k < read_size; ++k)
        {
            printf("%c", isprint(buffer[k]) ? buffer[k] : '?');
        }
        printf("\n");
        i += (u32)read_size;
    }
    return 0;
}








static int SCREEN_syncSrvMain(void* a)
{
    u32 frameCounter = 0;
    for (;;)
    {
        if (atomic_get(srv->shutdown))
        {
            break;
        }
        WebbyServerUpdate(srv->server);

        /* Push some test data over websockets */
        if (0 == (frameCounter & 0x7f))
        {
            for (u32 i = 0; i < srv->connectionCount; ++i)
            {
                WebbyBeginSocketFrame(srv->connection[i], WEBBY_WS_OP_TEXT_FRAME);
                WebbyPrintf(srv->connection[i], "Hello world over websockets!\n");
                WebbyEndSocketFrame(srv->connection[i]);
            }
        }
        sleep_ms(30);
        ++frameCounter;
    }
    return thrd_success;
}








void SCREEN_syncSrvStartup(void)
{
#if defined(_WIN32)
    {
        WORD wsa_version = MAKEWORD(2, 2);
        WSADATA wsa_data;
        if (0 != WSAStartup(wsa_version, &wsa_data))
        {
            // todo report
            return;
        }
    }
#endif

    struct WebbyServerConfig* config = srv->config;
    memset(config, 0, sizeof(srv->config));
    config->bind_address = "127.0.0.1";
    config->listening_port = 8081;
    config->flags = WEBBY_SERVER_WEBSOCKETS | WEBBY_SERVER_LOG_DEBUG;
    config->connection_max = 4;
    config->request_buffer_size = 2048;
    config->io_buffer_size = 8192;
    config->dispatch = SCREEN_syncSrv_dispatch;
    config->log = SCREEN_syncSrv_log;
    config->ws_connect = SCREEN_syncSrv_connect;
    config->ws_connected = SCREEN_syncSrv_connected;
    config->ws_closed = SCREEN_syncSrv_closed;
    config->ws_frame = SCREEN_syncSrv_frame;

    assert(!srv->memory);
    srv->memorySize = WebbyServerMemoryNeeded(config);
    srv->memory = malloc(srv->memorySize);
    srv->server = WebbyServerInit(config, srv->memory, srv->memorySize);

    thrd_create(&srv->thrd, (thrd_start_t)SCREEN_syncSrvMain, NULL);
}



void SCREEN_syncSrvDestroy(void)
{
    atomic_set(srv->shutdown, 1);
    thrd_join(srv->thrd, NULL);
    WebbyServerShutdown(srv->server);
    free(srv->memory);
    memset(srv, 0, sizeof(srv));

#if defined(_WIN32)
    WSACleanup();
#endif
}





































































