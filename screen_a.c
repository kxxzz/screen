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













const char* SCREEN_shaderCommonSrcHeader(void)
{
    static const char* a =
        "#version 300 es\n"
        "precision highp float;\n"
        "precision highp int;\n";
    return a;
}

const char* SCREEN_shaderVertexSrc(void)
{
    static const char* a =
        "in vec4 vPosition;\n"
        "void main()\n"
        "{\n"
        "    gl_Position = vPosition;\n"
        "}\n";
    return a;
}

const char* SCREEN_shaderFragmentSrcHeader(void)
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

const char* SCREEN_shaderFragmentSrcFooter(void)
{
    static const char* a =
        "void main()\n"
        "{\n"
        "   mainImage(outColor, gl_FragCoord.xy);\n"
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





























































































