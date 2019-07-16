#include "screen_a.h"
#include "screen_sync.h"

#ifdef _WIN32
# include <winsock2.h>
# include <ws2tcpip.h>
#endif

#include <threads.h>
#include <sleep.h>
#include <atomic.h>

#include <curl/curl.h>




curl_socket_t SCREEN_SyncClient_opensocketfunc(void* clientp, curlsocktype purpose, struct curl_sockaddr *address)
{
    SOCKET s = socket(address->family, address->socktype, address->protocol);
    return s;
}




void SCREEN_syncClientConn(const char* url)
{
    struct curl_slist* headerList;

    CURL* handle = curl_easy_init();
    headerList = curl_slist_append(NULL, "HTTP/1.1 101 WebSocket Protocol Handshake");
    headerList = curl_slist_append(headerList, "Upgrade: WebSocket");
    headerList = curl_slist_append(headerList, "Connection: Upgrade");
    headerList = curl_slist_append(headerList, "Sec-WebSocket-Version: 13");
    headerList = curl_slist_append(headerList, "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==");
    curl_easy_setopt(handle, CURLOPT_URL, url);
    curl_easy_setopt(handle, CURLOPT_HTTPHEADER, headerList);
    curl_easy_setopt(handle, CURLOPT_OPENSOCKETFUNCTION, SCREEN_SyncClient_opensocketfunc);
    //curl_easy_setopt(handle, CURLOPT_HEADERFUNCTION, my_func);
    //curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, my_writefunc);
    curl_easy_perform(handle);
}





void SCREEN_syncClientDisconn(void)
{

}






























































































