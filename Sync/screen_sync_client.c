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







void SCREEN_syncClientConn(const char* url)
{
    struct curl_slist* header_list_ptr;

    CURL* handle = curl_easy_init();
    header_list_ptr = curl_slist_append(NULL, "HTTP/1.1 101 WebSocket Protocol Handshake");
    header_list_ptr = curl_slist_append(header_list_ptr, "Upgrade: WebSocket");
    header_list_ptr = curl_slist_append(header_list_ptr, "Connection: Upgrade");
    header_list_ptr = curl_slist_append(header_list_ptr, "Sec-WebSocket-Version: 13");
    header_list_ptr = curl_slist_append(header_list_ptr, "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==");
    curl_easy_setopt(handle, CURLOPT_URL, url);
    //curl_easy_setopt(handle, CURLOPT_HTTPHEADER, header_list_ptr);
    //curl_easy_setopt(handle, CURLOPT_OPENSOCKETFUNCTION, my_opensocketfunc);
    //curl_easy_setopt(handle, CURLOPT_HEADERFUNCTION, my_func);
    //curl_easy_setopt(handle, CURLOPT_WRITEFUNCTION, my_writefunc);
    curl_easy_perform(handle);
}





void SCREEN_syncClientDisconn(void)
{

}






























































































