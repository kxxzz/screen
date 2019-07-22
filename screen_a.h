#pragma once



#include "screen.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <ctype.h>
#include <time.h>

#ifdef _WIN32
# include <gettimeofday.h>
#else
# include <sys/time.h>
#endif

#include <vec.h>




#ifdef ARYLEN
# undef ARYLEN
#endif
#define ARYLEN(a) (sizeof(a) / sizeof((a)[0]))




#ifdef max
# undef max
#endif
#ifdef min
# undef min
#endif
#define max(a,b) ((a) > (b) ? (a) : (b))
#define min(a,b) ((a) < (b) ? (a) : (b))




#define zalloc(sz) calloc(1, sz)





static int strcicmp(const char* a, const char* b)
{
    for (;; ++a, ++b)
    {
        int n = tolower(*a) - tolower(*b);
        if (n || !*a || !*b) return n;
    }
}




static char* stzncpy(char* dst, char const* src, u32 len)
{
    assert(len > 0);
#ifdef _WIN32
    char* p = _memccpy(dst, src, 0, len - 1);
#else
    char* p = memccpy(dst, src, 0, len - 1);
#endif
    if (p) --p;
    else
    {
        p = dst + len - 1;
        *p = 0;
    }
    return p;
}











#ifndef NDEBUG
# define SCREEN_SCENE_STRICT
#endif
















#ifdef __EMSCRIPTEN__
# include <GLES3/gl3.h>
# include <emscripten/emscripten.h>
# include <emscripten/html5.h>
#elif defined(__ANDROID__)
# if __ANDROID_API__ >= 24
#  include <GLES3/gl32.h>
# elif __ANDROID_API__ >= 21
#  include <GLES3/gl31.h>
# else
#  error
# endif
#else
# define SCREEN_USE_GL3W
# include <GL/gl3w.h>
# include <GL/glcorearb.h>
#endif






GLenum SCREEN_glCheck(const char *const file, int const line);

#ifndef NDEBUG
# define SCREEN_GL_CHECK() SCREEN_glCheck(__FILE__, __LINE__)
#else
# define SCREEN_GL_CHECK() SCREEN_glCheck(NULL, -1)
#endif























static GLenum SCREEN_glTargetTextureFromAssetType(SCREEN_AssetType type)
{
    assert(type < SCREEN_AssetTypeCount);
    static const GLenum a[SCREEN_AssetTypeCount] =
    {
        GL_TEXTURE_2D,
        GL_TEXTURE_3D,
        GL_TEXTURE_CUBE_MAP,
    };
    return a[type];
}


static GLenum SCREEN_glFilterFromChannelWrap(SCREEN_ChannelWrap wrap)
{
    assert(wrap < SCREEN_ChannelWrapCount);
    static const GLenum a[SCREEN_ChannelWrapCount] =
    {
        GL_REPEAT,
        GL_CLAMP_TO_EDGE,
    };
    return a[wrap];
}


static GLenum SCREEN_glMinFilterFromChannelFilter(SCREEN_ChannelFilter filter)
{
    assert(filter < SCREEN_ChannelFilterCount);
    static const GLenum a[SCREEN_ChannelFilterCount] =
    {
        GL_LINEAR_MIPMAP_LINEAR,
        GL_LINEAR,
        GL_NEAREST,
    };
    return a[filter];
}


static GLenum SCREEN_glMagFilterFromChannelFilter(SCREEN_ChannelFilter filter)
{
    assert(filter < SCREEN_ChannelFilterCount);
    static const GLenum a[SCREEN_ChannelFilterCount] =
    {
        GL_LINEAR,
        GL_LINEAR,
        GL_NEAREST,
    };
    return a[filter];
}











GLuint SCREEN_buildShaderProgram(const char* shaderComm, const char* shaderChannels, const char* shaderMain);






typedef struct SCREEN_AssetDev
{
    GLuint texture;
} SCREEN_AssetDev;

void SCREEN_assetDevOnLeave(SCREEN_AssetDev* dev);





typedef struct SCREEN_RenderPassDev
{
    bool entered;

    GLuint shaderProgram;
    GLuint texture;

    GLint uniform_Resolution;
    GLint uniform_Time;
    GLint uniform_TimeDelta;
    GLint uniform_Mouse;
    GLint uniform_Frame;
    GLint uniform_Channel[SCREEN_Channels_MAX];
    GLint uniform_ChannelTime[SCREEN_Channels_MAX];
    GLint uniform_ChannelResolution[SCREEN_Channels_MAX];
    GLint uniform_Date;
} SCREEN_RenderPassDev;

void SCREEN_renderPassDevOnLeave(SCREEN_RenderPassDev* dev);



void SCREEN_assetMakeGpuData(char* dstBuf, const char* sceneData, const SCREEN_Asset* asset);



u32 SCREEN_calcSceneDataSize(const char* sceneData, const SCREEN_Scene* scene);

bool SCREEN_validateScene(const SCREEN_Scene* scene);

















































































