#include "screen_a.h"



static const char* SCREEN_glErrStr(GLenum err)
{
    if (GL_NO_ERROR == err)
    {
        return "no error";
    }
    else
    {
        switch (err)
        {
        case GL_INVALID_ENUM:
            return "GL_INVALID_ENUM";
        case GL_INVALID_VALUE:
            return "GL_INVALID_VALUE";
        case GL_INVALID_OPERATION:
            return "GL_INVALID_OPERATION";
        case GL_OUT_OF_MEMORY:
            return "GL_OUT_OF_MEMORY";
        case GL_INVALID_FRAMEBUFFER_OPERATION:
            return "GL_INVALID_FRAMEBUFFER_OPERATION";
        default:
            return "unknown error";
        }
    }
}

GLenum SCREEN_glCheck(const char *const file, int const line)
{
#ifndef NDEBUG
    GLenum glerr = glGetError();
    if (glerr)
    {
        const char* errStr = SCREEN_glErrStr(glerr);
        assert(false);
    }
    return glerr;
#else
    return GL_NO_ERROR;
#endif
}
















void SCREEN_startup(void)
{
#ifdef SCREEN_USE_GL3W
    int err = gl3wInit();
    assert(0 == err);
#endif
    //printf("GL_VERSION  : %s\n", glGetString(GL_VERSION));
    //printf("GL_RENDERER : %s\n", glGetString(GL_RENDERER));
    assert(!SCREEN_GLCHECK());
}



void SCREEN_destroy(void)
{

}



void SCREEN_enter(u32 w, u32 h)
{

}



void SCREEN_leave(void)
{

}



void SCREEN_resize(u32 w, u32 h)
{

}



void SCREEN_frame(void)
{
    glClearColor(1.0f, 1.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);
}





































































































































