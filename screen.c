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


static const char* SCREEN_shaderCommonSrcHeader(void)
{
    static const char* a =
        "#version 300 es\n"
        "precision highp float;\n"
        "precision highp int;\n";
    return a;
}

static const char* SCREEN_shaderVertexSrc(void)
{
    static const char* a =
        "layout (location = 0) in vec3 vPosition;\n"
        "void main()\n"
        "{\n"
        "    gl_Position = vec4(vPosition, 1.0f);\n"
        "}\n";
    return a;
}

static const char* SCREEN_shaderFragmentSrcHeader(void)
{
    static const char* a =
        "uniform vec3      iResolution;\n"
        "uniform float     iTime;\n"
        "uniform float     iTimeDelta;\n"
        "uniform int       iFrame;\n"
        "uniform float     iChannelTime[4];\n"
        "uniform vec3      iChannelResolution[4];\n"
        "uniform vec4      iMouse;\n"
        "uniform sampler2D iChannel0;\n"
        "uniform sampler2D iChannel1;\n"
        "uniform sampler2D iChannel2;\n"
        "uniform sampler2D iChannel3;\n"
        "uniform vec4      iDate;\n"
        "uniform float     iSampleRate;\n"
        "out vec4 outColor;\n";
    return a;
}

static const char* SCREEN_shaderFragmentSrcFooter(void)
{
    static const char* a =
        "void main()\n"
        "{\n"
        "   outColor = vec4(1, 1, 0, 1);\n"
        "}\n";
    return a;
}


u32 SCREEN_compileShader(GLenum type, GLsizei numSrcs, const char** srcs)
{
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, numSrcs, srcs, 0);
    glCompileShader(shader);
    int status;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &status);
    if (!status)
    {
        char infoBuffer[4096];
        glGetShaderInfoLog(shader, sizeof(infoBuffer), &status, infoBuffer);
        assert(false);
    }
    return shader;
}




typedef struct SCREEN_Context
{
    GLuint shaderProgram;
} SCREEN_Context;

SCREEN_Context* ctx = NULL;




void SCREEN_startup(void)
{
#ifdef SCREEN_USE_GL3W
    int err = gl3wInit();
    assert(0 == err);
#endif
    ctx = (SCREEN_Context*)zalloc(sizeof(*ctx));
}



void SCREEN_destroy(void)
{
    free(ctx);
}



void SCREEN_enter(u32 w, u32 h)
{
    //printf("GL_VERSION  : %s\n", glGetString(GL_VERSION));
    //printf("GL_RENDERER : %s\n", glGetString(GL_RENDERER));
    SCREEN_GLCHECK();

    const char* shaderMain = "";

    const char* vsSrc[] =
    {
        SCREEN_shaderCommonSrcHeader(),
        SCREEN_shaderVertexSrc(),
    };
    GLuint vertShader = SCREEN_compileShader(GL_VERTEX_SHADER, ARYLEN(vsSrc), vsSrc);

    const char* fsSrc[] =
    {
        SCREEN_shaderCommonSrcHeader(),
        SCREEN_shaderFragmentSrcHeader(),
        shaderMain,
        SCREEN_shaderFragmentSrcFooter(),
    };
    GLuint fragShader = SCREEN_compileShader(GL_FRAGMENT_SHADER, ARYLEN(fsSrc), fsSrc);

    GLuint shaderProgram = ctx->shaderProgram = glCreateProgram();
    glAttachShader(shaderProgram, vertShader);
    glAttachShader(shaderProgram, fragShader);
    glLinkProgram(shaderProgram);

    int status;
    glGetProgramiv(shaderProgram, GL_LINK_STATUS, &status);
    if (!status)
    {
        char infoBuffer[4096];
        glGetProgramInfoLog(shaderProgram, sizeof(infoBuffer), &status, infoBuffer);
        assert(false);
    }
    glDeleteShader(fragShader);
    glDeleteShader(vertShader);
    glReleaseShaderCompiler();

    glUseProgram(shaderProgram);
    glValidateProgram(shaderProgram);

    glViewport(0, 0, w, h);
    SCREEN_GLCHECK();
}



void SCREEN_leave(void)
{
    glDeleteProgram(ctx->shaderProgram);
}



void SCREEN_resize(u32 w, u32 h)
{
    glViewport(0, 0, w, h);
    SCREEN_GLCHECK();
}



void SCREEN_frame(void)
{
    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);
    SCREEN_GLCHECK();

    glUseProgram(ctx->shaderProgram);

    static const GLfloat vertices[] =
    {
        -1.0f, -1.0f,
         1.0f, -1.0f,
        -1.0f,  1.0f,
         1.0f,  1.0f,
    };
    const GLint attribPosition = 0;
    glEnableVertexAttribArray(attribPosition);
    glVertexAttribPointer(attribPosition, 2, GL_FLOAT, GL_FALSE, 0, vertices);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
    SCREEN_GLCHECK();
}





































































































































