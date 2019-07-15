#pragma once


#ifdef _WIN32
# include <Windows.h>
#endif

#ifdef __EMSCRIPTEN__
# define HAVE_PTHREAD
# define HAVE_TIMESPEC_GET
#endif

#include <time.h>


static void sleep_ns(double ns)
{
    if (ns > 0)
    {
#ifdef _WIN32
        LARGE_INTEGER li;
        HANDLE timer = CreateWaitableTimer(NULL, TRUE, NULL);
        li.QuadPart = (LONGLONG)(__int64)(-ns / 100);
        SetWaitableTimer(timer, &li, 0, NULL, NULL, FALSE);
        WaitForSingleObject(timer, INFINITE);
        CloseHandle(timer);
#else
        struct timespec wait = { 0 };
        wait.tv_sec = ns / 1e9;
        wait.tv_nsec = ns - wait.tv_sec * 1e9;
        nanosleep(&wait, NULL);
#endif
    }
}

static void sleep_us(double us)
{
    sleep_ns(us * 1e3);
}

static void sleep_ms(double ms)
{
    sleep_ns(ms * 1e6);
}

static void sleep_ss(double ss)
{
    sleep_ns(ss * 1e9);
}







































































