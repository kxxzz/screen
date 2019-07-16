#include "screen_a.h"

#include <stb_image.h>





const char* SCREEN_AssetTypeNameTable(SCREEN_AssetType t)
{
    assert(t < SCREEN_AssetTypeCount);
    static const char* a[SCREEN_AssetTypeCount] =
    {
        "2d", "3d", "cube"
    };
    return a[t];
}




u32 SCREEN_assetGpuDataSize(const SCREEN_Asset* asset)
{
    switch (asset->type)
    {
    case SCREEN_AssetType_2D:
        return asset->size[0] * asset->size[1] * asset->components;
    case SCREEN_AssetType_3D:
        return asset->size[0] * asset->size[1] * asset->size[2] * asset->components;
    case SCREEN_AssetType_Cube:
        return asset->size[0] * asset->size[1] * asset->components * 6;
    default:
        assert(false);
        return 0;
    }
}







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



















static GLuint SCREEN_compileShader(GLenum type, GLsizei srcCount, const char** srcs)
{
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, srcCount, srcs, 0);
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










GLuint SCREEN_buildShaderProgram(const char* shaderComm, const char* shaderChannels, const char* shaderMain)
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
        shaderChannels,
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














void SCREEN_assetDevOnLeave(SCREEN_AssetDev* dev)
{
    if (dev->texture)
    {
        glDeleteTextures(1, &dev->texture);
    }
    memset(dev, 0, sizeof(*dev));
}








void SCREEN_renderPassDevOnLeave(SCREEN_RenderPassDev* dev)
{
    if (dev->texture)
    {
        glDeleteTextures(1, &dev->texture);
    }
    if (dev->shaderProgram)
    {
        glDeleteProgram(dev->shaderProgram);
    }
    memset(dev, 0, sizeof(*dev));
}












void SCREEN_assetMakeGpuData(char* dstBuf, const char* sceneData, const SCREEN_Asset* asset)
{
    if (SCREEN_AssetType_2D == asset->type)
    {
        int x, y, comp;
        stbi_uc* data = stbi_load_from_memory
        (
            sceneData + asset->dataOffset, asset->dataSize, &x, &y, &comp, asset->components
        );
        if (!data)
        {
            // todo report error
            return;
        }
        assert(asset->size[0] == x);
        assert(asset->size[1] == y);
        assert(asset->components == comp);
        u32 size = x * y * comp;
        memmove(dstBuf, data, size);
        stbi_image_free(data);
    }
    else if (SCREEN_AssetType_Cube == asset->type)
    {
        u32 size = asset->size[0] * asset->size[1] * asset->components;
        u32 srcDataOff = 0;
        for (u32 f = 0; f < 6; ++f)
        {
            int x, y, comp;
            u32 srcDataSize = asset->cubeFaceDataSize[f];
            stbi_uc* data = stbi_load_from_memory
            (
                sceneData + asset->dataOffset + srcDataOff, srcDataSize, &x, &y, &comp, asset->components
            );
            if (!data)
            {
                // todo report error
                return;
            }
            assert(asset->size[0] == x);
            assert(asset->size[1] == y);
            assert(asset->components == comp);
            memmove(dstBuf + f*size, data, size);
            stbi_image_free(data);
            srcDataOff += srcDataSize;
        }
    }
    else
    {
        // todo report error
        return;
    }
}














u32 SCREEN_calcSceneDataSize(const char* sceneData, const SCREEN_Scene* scene)
{
    u32 size = 0;
    if (scene->commonShaderCodeOffset != -1)
    {
        size += (u32)strlen(sceneData + scene->commonShaderCodeOffset) + 1;
    }
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (scene->buffer[i].shaderCodeOffset != -1)
        {
            size += (u32)strlen(sceneData + scene->buffer[i].shaderCodeOffset) + 1;
        }
    }
    if (scene->image.shaderCodeOffset != -1)
    {
        size += (u32)strlen(sceneData + scene->image.shaderCodeOffset) + 1;
    }
    for (u32 ai = 0; ai < SCREEN_Assets_MAX; ++ai)
    {
        const SCREEN_Asset* asset = scene->asset + ai;
        size += asset->dataSize;
    }
    return size;
}



bool SCREEN_validateScene(const SCREEN_Scene* scene)
{
    return true;
}





























































