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
        "#version 320 es\n"
        //"#version 460\n"
        //"precision mediump float;\n"
        //"precision mediump int;\n"
        "precision highp float;\n"
        "precision highp int;\n"
        ;
    return a;
}

static const char* SCREEN_shaderVertexSrc(void)
{
    static const char* a =
        "layout (location = 0) in vec4 vPosition;\n"
        "void main()\n"
        "{\n"
        "    gl_Position = vPosition;\n"
        "}\n"
        ;
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
        "uniform vec4      iDate;\n"
        "uniform float     iSampleRate;\n"
        "out vec4 outColor;\n"
        "uniform sampler2D iChannel0;\n"
        "uniform sampler2D iChannel1;\n"
        "uniform sampler2D iChannel2;\n"
        "uniform sampler2D iChannel3;\n"
        ;
    return a;
}

static const char* SCREEN_shaderFragmentSrcFooter(void)
{
    static const char* a =
        "void main()\n"
        "{\n"
        "   mainImage(outColor, gl_FragCoord.xy);\n"
        "}\n";
    return a;
}

















static GLuint SCREEN_compileShader(GLenum type, GLsizei numSrcs, const char** srcs)
{
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, numSrcs, srcs, 0);
    glCompileShader(shader);
    int status;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &status);
    if (!status)
    {
        char infoBuf[4096];
        glGetShaderInfoLog(shader, sizeof(infoBuf), &status, infoBuf);
        // todo report
        assert(false);
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}










GLuint SCREEN_buildShaderProgram(const char* shaderComm, const char* shaderMain)
{
    const char* vsSrc[] =
    {
        SCREEN_shaderCommonSrcHeader(),
        SCREEN_shaderVertexSrc(),
    };
    GLuint vertShader = SCREEN_compileShader(GL_VERTEX_SHADER, ARYLEN(vsSrc), vsSrc);
    if (!vertShader)
    {
        return 0;
    }

    const char* fsSrc[] =
    {
        SCREEN_shaderCommonSrcHeader(),
        SCREEN_shaderFragmentSrcHeader(),
        shaderComm ? shaderComm : "",
        shaderMain,
        SCREEN_shaderFragmentSrcFooter(),
    };
    GLuint fragShader = SCREEN_compileShader(GL_FRAGMENT_SHADER, ARYLEN(fsSrc), fsSrc);
    if (!fragShader)
    {
        glDeleteShader(vertShader);
        return 0;
    }

    GLuint shaderProgram = glCreateProgram();
    glAttachShader(shaderProgram, vertShader);
    glAttachShader(shaderProgram, fragShader);
    glLinkProgram(shaderProgram);

    GLint status;
    glGetProgramiv(shaderProgram, GL_LINK_STATUS, &status);
    if (!status)
    {
        char infoBuf[4096];
        glGetProgramInfoLog(shaderProgram, sizeof(infoBuf), &status, infoBuf);
        assert(false);
        glDeleteShader(fragShader);
        glDeleteShader(vertShader);
        glDeleteProgram(shaderProgram);
        return 0;
    }
    glDeleteShader(fragShader);
    glDeleteShader(vertShader);
    glReleaseShaderCompiler();

    glUseProgram(shaderProgram);
    glValidateProgram(shaderProgram);
    glGetProgramiv(shaderProgram, GL_VALIDATE_STATUS, &status);
    assert(status);

    SCREEN_GL_CHECK();
    return shaderProgram;
}



















void SCREEN_renderPassDevOnLeave(SCREEN_RenderPassDev* dev)
{
    if (!dev->entered)
    {
        return;
    }
    dev->entered = false;
    if (dev->texture)
    {
        glDeleteTextures(1, &dev->texture);
    }
    glDeleteProgram(dev->shaderProgram);
    memset(dev, 0, sizeof(*dev));
}












u32 SCREEN_calcSceneDataSize(const SCREEN_Scene* scene)
{
    u32 size = 0;
    if (scene->shaderComm)
    {
        size += (u32)strlen(scene->shaderComm) + 1;
    }
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (scene->buffer[i].shaderCode)
        {
            size += (u32)strlen(scene->buffer[i].shaderCode) + 1;
        }
    }
    if (scene->image.shaderCode)
    {
        size += (u32)strlen(scene->image.shaderCode) + 1;
    }
    return size;
}



bool SCREEN_validateScene(const SCREEN_Scene* scene)
{
    return true;
}





























































