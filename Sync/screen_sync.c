#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>

#define WBY_IMPLEMENTATION
#define WBY_UINT_PTR uintptr_t
#include <wby.h>




typedef struct SCREEN_SyncSrv
{
    struct wby_server wby[1];
    void* memory;
} SCREEN_SyncSrv;

static SCREEN_SyncSrv srv[1] = { 0 };





void SCREEN_syncSrvStartup(void)
{
    struct wby_config config[1];
    memset(config, 0, sizeof(config));
    config->address = "127.0.0.1";
    config->port = 8888;
    config->connection_max = 8;
    config->request_buffer_size = 2048;
    config->io_buffer_size = 8192;
    config->dispatch = dispatch;
    config->ws_connect = websocket_connect;
    config->ws_connected = websocket_connected;
    config->ws_frame = websocket_frame;
    config->ws_closed = websocket_closed;

    assert(!srv->memory);
    size_t memorySize;
    wby_init(srv->wby, &config, &memorySize);
    srv->memory = zalloc(memorySize);
    wby_start(srv->wby, srv->memory);
}



void SCREEN_syncSrvDestroy(void)
{
    wby_stop(srv->wby);
    free(srv->memory);
    memset(srv, 0, sizeof(*srv));
}





































































