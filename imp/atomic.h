#pragma once


#include <stdint.h>


#if defined(_MSC_VER) && defined(_WIN64)
# include <intrin.h>
# define __sync_add_and_fetch(p,x)               (_InterlockedExchangeAdd64((__int64 volatile *)(p), (x)) + (x))
# define __sync_bool_compare_and_swap(p, c, s)   (_InterlockedCompareExchange64((__int64 volatile *)(p), (__int64)(s), (__int64)(c)) == (__int64)(c))
# define __sync_lock_test_and_set(p,v)           (_InterlockedExchange64( (__int64 volatile *)(p), (__int64)(v) ))
#endif


static int64_t atomic_set(int64_t* p, const int v)
{
    return __sync_lock_test_and_set(p, v);
}
static int64_t atomic_get(int64_t* p)
{
    return __sync_add_and_fetch(p, 0);
}
static int64_t atomic_inc(int64_t* p)
{
    return __sync_add_and_fetch(p, +1);
}
static int64_t atomic_dec(int64_t* p)
{
    return __sync_add_and_fetch(p, -1);
}



































































