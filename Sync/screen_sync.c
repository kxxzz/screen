#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>

#include <webby.h>




typedef struct SCREEN_SyncSrv
{
    struct WebbyServer* server;
    struct WebbyServerConfig config[1];
    void* memory;
    int memorySize;
} SCREEN_SyncSrv;

static SCREEN_SyncSrv srv[1] = { 0 };

















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
    config->flags = WEBBY_SERVER_WEBSOCKETS;
    config->connection_max = 4;
    config->request_buffer_size = 2048;
    config->io_buffer_size = 8192;
    //config->dispatch = test_dispatch;
    //config->log = test_log;
    //config->ws_connect = test_ws_connect;
    //config->ws_connected = test_ws_connected;
    //config->ws_closed = test_ws_closed;
    //config->ws_frame = test_ws_frame;

    assert(!srv->memory);
    srv->memorySize = WebbyServerMemoryNeeded(config);
    srv->memory = malloc(srv->memorySize);
    srv->server = WebbyServerInit(config, srv->memory, srv->memorySize);
}



void SCREEN_syncSrvDestroy(void)
{
    WebbyServerShutdown(srv->server);
    free(srv->memory);
    memset(srv, 0, sizeof(srv));

#if defined(_WIN32)
    WSACleanup();
#endif
}





































































