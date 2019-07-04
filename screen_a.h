#pragma once



#include "screen.h"

#include <assert.h>
#include <stdio.h>
#include <stdlib.h>

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
# define SCREEN_GLCHECK() SCREEN_glCheck(__FILE__, __LINE__)
#else
# define SCREEN_GLCHECK() SCREEN_glCheck(NULL, -1)
#endif





GLuint SCREEN_buildShaderProgram(const char* shaderComm, const char* shaderMain);






typedef struct SCREEN_BufferRun
{
    GLuint shaderProgram;

    GLint uniform_Resolution;
    GLint uniform_Time;
    GLint uniform_Mouse;
} SCREEN_BufferRun;

void SCREEN_bufferRunEnter(SCREEN_BufferRun* b, const SCREEN_Buffer* desc);
void SCREEN_bufferRunLeave(SCREEN_BufferRun* b);
void SCREEN_bufferRunBindUniform(SCREEN_BufferRun* b);







u32 SCREEN_calcSceneDataSize(const SCREEN_Scene* scene);

bool SCREEN_validateScene(const SCREEN_Scene* scene);

















































































