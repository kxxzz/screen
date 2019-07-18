#include "screen_a.h"
#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>
#include <sleep.h>
#include <atomic.h>

#include <dyad.h>




enum
{
    WS_KEY_SIZE = 16,
    HOST_NAME_MAX = 64,
    MAX_REQUEST_PATH_LENGTH = 2048,
};



typedef enum WS_FrameOp
{
    WS_FrameOp_Continuation = 0x0,
    WS_FrameOp_Text = 0x1,
    WS_FrameOp_Binary = 0x2,
    WS_FrameOp_DataUnused = 0x3,
    WS_FrameOp_Close = 0x8,
    WS_FrameOp_Ping = 0x9,
    WS_FrameOp_Pong = 0xA,
    WS_FrameOp_ControlUnused = 0xB,
} WS_FrameOp;






typedef struct SCREEN_SyncClient
{
    bool connected;
    char host[HOST_NAME_MAX];
    u32 port;
    char uri[MAX_REQUEST_PATH_LENGTH];

    dyad_Stream* handle;

    bool handshaked;
    WS_FrameOp opState;
    u32 remain;
    vec_char sendBuf[1];
    vec_char recvBuf[1];
} SCREEN_SyncClient;

static SCREEN_SyncClient ctx[1] = { 0 };

static void SCREEN_syncClientCleanup(void)
{
    vec_free(ctx->recvBuf);
    vec_free(ctx->sendBuf);
    memset(ctx, 0, sizeof(*ctx));
}













void SCREEN_syncClientStartup(const char* url)
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
    //stzncpy(ctx->host, host, HOST_NAME_MAX);
    //ctx->port = port;
    //stzncpy(ctx->uri, uri, MAX_REQUEST_PATH_LENGTH);

    dyad_init();
    dyad_Stream* s = dyad_newStream();
    ctx->handle = s;
    //dyad_addListener(s, DYAD_EVENT_ERROR, COUS_onError, NULL);
    //dyad_addListener(s, DYAD_EVENT_TIMEOUT, COUS_onTimeout, NULL);
    //dyad_addListener(s, DYAD_EVENT_CLOSE, COUS_onClose, NULL);
    //dyad_addListener(s, DYAD_EVENT_CONNECT, COUS_onConnect, NULL);
    //dyad_addListener(s, DYAD_EVENT_DATA, COUS_onData, NULL);
    int r = 0;// dyad_connect(s, host, port);
    if (r != 0)
    {
        dyad_shutdown();
        SCREEN_syncClientCleanup();
        return;
    }
    ctx->connected = true;
}





void SCREEN_syncClientDestroy(void)
{
    dyad_shutdown();
    SCREEN_syncClientCleanup();
#if defined(_WIN32)
    WSACleanup();
#endif
}






























































































