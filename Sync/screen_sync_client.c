#include "screen_a.h"
#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>
#include <sleep.h>
#include <atomic.h>








void SCREEN_syncClientConn(const char* url)
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

}





void SCREEN_syncClientDisconn(void)
{
#if defined(_WIN32)
    WSACleanup();
#endif
}






























































































