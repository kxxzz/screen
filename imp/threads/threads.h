/*
 * C11 <threads.h> emulation library
 *
 * (C) Copyright yohhoy 2012.
 * Distributed under the Boost Software License, Version 1.0.
 *
 * Permission is hereby granted, free of charge, to any person or organization
 * obtaining a copy of the software and accompanying documentation covered by
 * this license (the "Software") to use, reproduce, display, distribute,
 * execute, and transmit the Software, and to prepare [[derivative work]]s of the
 * Software, and to permit third-parties to whom the Software is furnished to
 * do so, all subject to the following:
 *
 * The copyright notices in the Software and this entire statement, including
 * the above license grant, this restriction and the following disclaimer,
 * must be included in all copies of the Software, in whole or in part, and
 * all derivative works of the Software, unless such copies or derivative
 * works are solely in the form of machine-executable object code generated by
 * a source language processor.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. IN NO EVENT
 * SHALL THE COPYRIGHT HOLDERS OR ANYONE DISTRIBUTING THE SOFTWARE BE LIABLE
 * FOR ANY DAMAGES OR OTHER LIABILITY, WHETHER IN CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */
#ifndef EMULATED_THREADS_H_INCLUDED_
#define EMULATED_THREADS_H_INCLUDED_

#include <time.h>

#ifndef TIME_UTC
#define TIME_UTC 1
#endif

//#include "c99_compat.h" /* for `inline` */

/*---------------------------- types ----------------------------*/
typedef void (*tss_dtor_t)(void*);
typedef int (*thrd_start_t)(void*);


/*-------------------- enumeration constants --------------------*/
enum {
    mtx_plain     = 0,
    mtx_try       = 1,
    mtx_timed     = 2,
    mtx_recursive = 4
};

enum {
    thrd_success = 0, // succeeded
    thrd_timeout,     // timeout
    thrd_error,       // failed
    thrd_busy,        // resource busy
    thrd_nomem        // out of memory
};

/*-------------------------- functions --------------------------*/

#if defined(_WIN32) && !defined(__CYGWIN__)
#include "threads_win32.h"
#elif defined(HAVE_PTHREAD)
#include "threads_posix.h"
#else
#error Not supported on this platform.
#endif



#endif /* EMULATED_THREADS_H_INCLUDED_ */
