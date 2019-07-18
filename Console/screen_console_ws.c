#include "screen_console_a.h"
#include "screen_console_ws.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <dyad.h>
#include <base64.h>

#include <threads.h>
#include <sleep.h>
#include <atomic.h>





static char SCREEN_ConsoleURL[SCREEN_ConsoleURL_MAX];


void SCREEN_consoleSetURL(const char* url)
{
    stzncpy(SCREEN_ConsoleURL, url, SCREEN_ConsoleURL_MAX);
}










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










typedef struct SCREEN_Console
{
    bool connected;
    char host[HOST_NAME_MAX];
    u32 port;
    char uri[MAX_REQUEST_PATH_LENGTH];
    dyad_Stream* stream;

    bool handshaked;
    WS_FrameOp opState;
    u32 remain;
    vec_char sendBuf[1];
    vec_char recvBuf[1];

    thrd_t thrd;
    int64_t shutdown[1];
} SCREEN_Console;

static SCREEN_Console* ctx = NULL;


static void SCREEN_consoleCleanup(void)
{
    assert(ctx);
    vec_free(ctx->recvBuf);
    vec_free(ctx->sendBuf);
    ctx = NULL;
}





















static void SCREEN_consoleSend(WS_FrameOp opcode, const char* data, u32 len)
{
    u8 finalFragment = 1;
    const u8 masked = 1;
    u8 headerSize = 2;

    u8 payloadField;
    if (len < 126)
    {
        payloadField = len;
    }
    else if (len <= 0xffff)
    {
        headerSize += 2;
        payloadField = 126;
    }
    else
    {
        headerSize += 8;
        payloadField = 127;
    }
    if (masked)
    {
        headerSize += 4;
    }
    vec_resize(ctx->sendBuf, headerSize + len);
    char* sendBuf = ctx->sendBuf->data;
    memset(sendBuf, 0, headerSize);
    sendBuf[0] = finalFragment << 7 | (u8)opcode;
    sendBuf[1] = masked << 7 | payloadField;
    if (126 == payloadField)
    {
        *(uint16_t*)(sendBuf + 2) = htons((u_short)len);
    }
    else if (127 == payloadField)
    {
        *(uint64_t*)(sendBuf + 2) = htonll(len);
    }
    memcpy(sendBuf + headerSize, data, len);

    if (masked)
    {
        char maskingKey[4];
        *(u32*)maskingKey = rand();
        memcpy(sendBuf + headerSize - 4, maskingKey, 4);
        for (u32 i = 0; i < len; ++i)
        {
            sendBuf[headerSize + i] ^= maskingKey[i % 4];
        }
    }
    dyad_write(ctx->stream, sendBuf, headerSize + len);
}





static void SCREEN_consoleSendText(const char* text, u32 len)
{
    SCREEN_consoleSend(WS_FrameOp_Text, text, len);
}

static void SCREEN_consoleSendBinrary(const char* data, u32 len)
{
    SCREEN_consoleSend(WS_FrameOp_Binary, data, len);
}

static void SCREEN_consoleSendClose(void)
{
    SCREEN_consoleSend(WS_FrameOp_Close, NULL, 0);
}




















static void SCREEN_console_onError(dyad_Event *e)
{
    //printf("[Console] error: %s\n", e->msg);
}

static void SCREEN_console_onTimeout(dyad_Event *e)
{
    printf("[Console] timeout: %s\n", e->msg);
}

static void SCREEN_console_onClose(dyad_Event *e)
{
    if (ctx->connected)
    {
        ctx->connected = false;
        printf("[Console] disconnected\n");
    }
}




static void SCREEN_console_onConnect(dyad_Event *e)
{
    printf("[Console] connected\n");

    ctx->connected = true;

    const char* requestFmt =
        "GET %s HTTP/1.1\r\n"
        "Host: %s:%u\r\n"
        "Connection: Upgrade\r\n"
        "Upgrade: websocket\r\n"
        "Sec-WebSocket-Version: 13\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "\r\n";

    u32 key[WS_KEY_SIZE / 4];
    for (u32 i = 0; i < WS_KEY_SIZE / 4; ++i)
    {
        key[i] = rand();
    }
    char* keyStr = base64_encode((char*)key, WS_KEY_SIZE, NULL);

    s32 n = snprintf(NULL, 0, requestFmt, ctx->uri, ctx->host, ctx->port, keyStr);
    vec_resize(ctx->sendBuf, n + 1);
    n = snprintf(ctx->sendBuf->data, ctx->sendBuf->length, requestFmt, ctx->uri, ctx->host, ctx->port, keyStr);
    free(keyStr);
    if (n > 0)
    {
        dyad_write((dyad_Stream*)ctx->stream, ctx->sendBuf->data, n);
    }
    else
    {
        // report
    }
}




static void SCREEN_console_onData(dyad_Event* e)
{
    if (!ctx->handshaked)
    {
        ctx->handshaked = true;

        printf("[Console] handshaked\n");
        printf("%s", e->data);
    }
    else
    {
        // https://tools.ietf.org/html/rfc6455#section-5.2

        char* newData = NULL;
        if (WS_FrameOp_Continuation == ctx->opState)
        {
            u8 finalFragment = e->data[0] >> 7 & 0x1;
            WS_FrameOp opcode = e->data[0] & 0xf;
            u8 masked = e->data[1] >> 7 & 0x1;
            u32 payloadLength = e->data[1] & 0x7f;

            if (payloadLength < 126)
            {
                newData = e->data + 2;
            }
            else if (payloadLength == 126)
            {
                payloadLength = ntohs(*(u16*)(e->data + 2));
                newData = e->data + 2 + 2;
            }
            else if (payloadLength == 127)
            {
                payloadLength = (u32)ntohll(*(u64*)(e->data + 2));
                newData = e->data + 2 + 8;
            }

            if (masked)
            {
                u8 maskingKey[4];
                memcpy(maskingKey, newData, 4);
                newData += 4;
                for (u32 i = 0; i < payloadLength; ++i)
                {
                    newData[i] ^= maskingKey[i % 4];
                }
            }
            ctx->opState = opcode;
            ctx->remain = payloadLength;
            vec_resize(ctx->recvBuf, 0);
        }
        else
        {
            newData = e->data;
        }

        u32 newDataLen = (u32)(e->data + e->size - newData);
        if (newDataLen && ctx->remain)
        {
            newDataLen = min(newDataLen, ctx->remain);
            ctx->remain -= newDataLen;

            vec_pusharr(ctx->recvBuf, newData, newDataLen);
        }
        if (newDataLen && !ctx->remain)
        {
            switch (ctx->opState)
            {
            case WS_FrameOp_Text:
            {
                vec_push(ctx->recvBuf, 0);
                printf("[Console] incommig text\n%s", ctx->recvBuf->data);
                SCREEN_consoleSendText(ctx->recvBuf->data, ctx->recvBuf->length);
                break;
            }
            case WS_FrameOp_Binary:
            {
                printf("[Console] incommig binrary size=%u\n", ctx->recvBuf->length);
                SCREEN_cmdExec(ctx->recvBuf->data, ctx->recvBuf->length);
                break;
            }
            case WS_FrameOp_Close:
            {
                //printf("[Console] closed\n");
                //ctx->connected = false;
                break;
            }
            case WS_FrameOp_Ping:
            case WS_FrameOp_Pong:
            {
                // todo
                break;
            }
            default:
                printf("[Console] unhandled opcode=%u\n", ctx->opState);
                printf("\n%s\n", ctx->recvBuf->data);
                break;
            }
            ctx->opState = WS_FrameOp_Continuation;
        }
    }
}








static int SCREEN_consoleMainLoop(void* _)
{
    for (;;)
    {
        if (atomic_get(ctx->shutdown))
        {
            break;
        }
        if (DYAD_STATE_CLOSED == dyad_getState(ctx->stream))
        {
            int r = dyad_connect(ctx->stream, ctx->host, ctx->port);
            if (r != 0)
            {
                printf("[Console] can't connect %s:%u/%s", ctx->host, ctx->port, ctx->uri);
                continue;
            }
        }
        else
        {
            dyad_update();
        }
    }
    return thrd_success;
}




void SCREEN_consoleStartup(void)
{
    char host[256] = "";
    u32 port = -1;
    char uri[SCREEN_ConsoleURL_MAX] = "/";
    if (3 == sscanf(SCREEN_ConsoleURL, "%99[^:]:%99u/%99[^\n]", host, &port, uri)) {}
    else if (3 == sscanf(SCREEN_ConsoleURL, "ws://%99[^:]:%99u/%99[^\n]", host, &port, uri)) {}
    else if (2 == sscanf(SCREEN_ConsoleURL, "%99[^:]:%99u", host, &port)) {}
    else if (2 == sscanf(SCREEN_ConsoleURL, "ws://%99[^:]:%99u", host, &port)) {}
    else
    {
        // report error
        return;
    }
    assert(!ctx);
    ctx = zalloc(sizeof(*ctx));
    stzncpy(ctx->host, host, HOST_NAME_MAX);
    ctx->port = port;
    stzncpy(ctx->uri, uri, MAX_REQUEST_PATH_LENGTH);

    dyad_init();
    dyad_Stream* s = dyad_newStream();
    if (!s)
    {
        // report error
        return;
    }
    ctx->stream = s;

    dyad_addListener(s, DYAD_EVENT_ERROR, SCREEN_console_onError, NULL);
    dyad_addListener(s, DYAD_EVENT_TIMEOUT, SCREEN_console_onTimeout, NULL);
    dyad_addListener(s, DYAD_EVENT_CLOSE, SCREEN_console_onClose, NULL);
    dyad_addListener(s, DYAD_EVENT_CONNECT, SCREEN_console_onConnect, NULL);
    dyad_addListener(s, DYAD_EVENT_DATA, SCREEN_console_onData, NULL);

    thrd_create(&ctx->thrd, (thrd_start_t)SCREEN_consoleMainLoop, NULL);
}





void SCREEN_consoleDestroy(void)
{
    atomic_set(ctx->shutdown, 1);
    thrd_join(ctx->thrd, NULL);

    dyad_shutdown();
    SCREEN_consoleCleanup();
}






































































































