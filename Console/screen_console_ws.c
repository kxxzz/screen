#include "screen_console_a.h"
#include "screen_console_ws.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <uv.h>
#include <base64.h>





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





typedef enum SCREEN_ConsoleState
{
    SCREEN_ConsoleState_Disconnected = 0,
    SCREEN_ConsoleState_Connecting,
    SCREEN_ConsoleState_Connected,
    SCREEN_ConsoleState_Handshaked,
} SCREEN_ConsoleState;




typedef struct SCREEN_Console
{
    char host[HOST_NAME_MAX];
    u32 port;
    char uri[MAX_REQUEST_PATH_LENGTH];

    SCREEN_ConsoleState state;
    WS_FrameOp opState;
    u32 remain;
    vec_char sendBuf[1];
    vec_char recvBuf[1];

    uv_loop_t* loop;
    uv_tcp_t sock[1];
    uv_connect_t conn[1];
    uv_write_t writeReq[1];
    uv_shutdown_t shutdownReq[1];
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
    uv_buf_t uvBuf = { headerSize + len, sendBuf };
    uv_write(ctx->writeReq, ctx->conn->handle, &uvBuf, 1, NULL);
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


















static void SCREEN_console_onAlloc(uv_handle_t* handle, size_t size, uv_buf_t* buf)
{
    static char uvReadBuf[1024*64];
    *buf = uv_buf_init(uvReadBuf, (int)min(size, sizeof(uvReadBuf)));
}



static void SCREEN_console_onClose(uv_handle_t* handle)
{
    printf("[Console] disconnected\n");
    ctx->state = SCREEN_ConsoleState_Disconnected;
}




static void SCREEN_console_onRead(uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf)
{
    if (nread < 0)
    {
        uv_close((uv_handle_t*)stream, SCREEN_console_onClose);
        return;
    }
    assert(nread <= buf->len);
    char* base = buf->base;
    u32 len = (u32)nread;
    if (ctx->state != SCREEN_ConsoleState_Handshaked)
    {
        assert(SCREEN_ConsoleState_Connected == ctx->state);
        ctx->state = SCREEN_ConsoleState_Handshaked;

        printf("[Console] handshaked\n");
        vec_resize(ctx->recvBuf, len + 1);
        memcpy(ctx->recvBuf->data, base, len);
        ctx->recvBuf->data[len] = 0;
        printf("%s", ctx->recvBuf->data);
    }
    else
    {
        // https://tools.ietf.org/html/rfc6455#section-5.2

        char* newData = NULL;
        if (WS_FrameOp_Continuation == ctx->opState)
        {
            u8 finalFragment = base[0] >> 7 & 0x1;
            WS_FrameOp opcode = base[0] & 0xf;
            u8 masked = base[1] >> 7 & 0x1;
            u32 payloadLength = base[1] & 0x7f;

            if (payloadLength < 126)
            {
                newData = base + 2;
            }
            else if (payloadLength == 126)
            {
                payloadLength = ntohs(*(u16*)(base + 2));
                newData = base + 2 + 2;
            }
            else if (payloadLength == 127)
            {
                payloadLength = (u32)ntohll(*(u64*)(base + 2));
                newData = base + 2 + 8;
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
            newData = base;
        }

        u32 newDataLen = (u32)(base + len - newData);
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
    uv_read_start(ctx->conn->handle, SCREEN_console_onAlloc, SCREEN_console_onRead);
}








static void SCREEN_console_onConnect(uv_connect_t* conn, int status)
{
    if (status != 0)
    {
        ctx->state = SCREEN_ConsoleState_Disconnected;
        char errStr[4096];
        uv_strerror_r(status, errStr, sizeof(errStr));
        printf("[Console] error: %s\n", errStr);
        return;
    }

    printf("[Console] connected\n");
    assert(ctx->conn == conn);

    assert(SCREEN_ConsoleState_Connecting == ctx->state);
    ctx->state = SCREEN_ConsoleState_Connected;

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
    assert(n > 0);
    uv_buf_t uvBuf = { n, ctx->sendBuf->data };
    uv_write(ctx->writeReq, ctx->conn->handle, &uvBuf, 1, NULL);
    uv_read_start(ctx->conn->handle, SCREEN_console_onAlloc, SCREEN_console_onRead);
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

    ctx->loop = uv_default_loop();
}





void SCREEN_consoleDestroy(void)
{
    SCREEN_consoleCleanup();
}




void SCREEN_consoleUpdate(void)
{
    if (SCREEN_ConsoleState_Disconnected == ctx->state)
    {
        uv_tcp_init(ctx->loop, ctx->sock);
        struct sockaddr_in dest[1];
        uv_ip4_addr(ctx->host, ctx->port, dest);
        if (0 == uv_tcp_connect(ctx->conn, ctx->sock, (const struct sockaddr*)dest, SCREEN_console_onConnect))
        {
            ctx->state = SCREEN_ConsoleState_Connecting;
        }
    }
    else
    {
        uv_run(ctx->loop, UV_RUN_NOWAIT);
    }
}

































































































