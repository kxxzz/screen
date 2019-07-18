#include "screen_a.h"



typedef enum SCREEN_KeyboardState
{
    SCREEN_KeyboardState_KeyDown = 0,
    SCREEN_KeyboardState_KeyPressed,
    SCREEN_KeyboardState_KeyToggle,
    SCREEN_KeyboardStateCount
} SCREEN_KeyboardState;


enum
{
    SCREEN_KeyboardTextureFormat = GL_R8,
    SCREEN_KeyboardTextureDataFormat = GL_RED,
    SCREEN_KeyboardTextureDataType = GL_UNSIGNED_BYTE,
};




typedef struct SCREEN_Context
{
    // screen config
    SCREEN_RenderSize renderSize[1];

    // screen context
    GLenum textureInternalFormat;
    u32 width, height;
    f32 screenToRender;
    u32 renderWidth, renderHeight;
    bool imageRenderDirect;
    bool sceneLoaded;
    SCREEN_Scene scene[1];

    // gpu runtime
    bool entered;
    SCREEN_AssetDev asset[SCREEN_Assets_MAX];
    SCREEN_RenderPassDev buffer[SCREEN_Buffers_MAX];
    SCREEN_RenderPassDev image[1];
    GLuint vb;
    GLuint va;
    GLuint fb;
    GLuint texKeyboard;

    // scene context
    u32 frame;
    f32 time;
    f32 timeDelta;
    // screen space
    int pointX, pointY;
    int pointStart[2];
    u8 keyboardState[SCREEN_KeyboardStateCount][SCREEN_KeyCount];

    // data buffer
    vec_char assetGpuData[SCREEN_Assets_MAX];
    vec_char sceneDataBuf[1];
    vec_char tmpDataBuf[1];
} SCREEN_Context;

static SCREEN_Context* ctx = NULL;




void SCREEN_startup(void)
{
#ifdef SCREEN_USE_GL3W
    int err = gl3wInit();
    assert(0 == err);
#endif
    assert(!ctx);
    ctx = (SCREEN_Context*)zalloc(sizeof(*ctx));

    ctx->textureInternalFormat = GL_RGBA32F;
    SCREEN_RenderSize renderSize = { SCREEN_RenderSizeMode_Scale, .scale = 1 };
    ctx->renderSize[0] = renderSize;
}



void SCREEN_destroy(void)
{
    assert(ctx);
    vec_free(ctx->tmpDataBuf);
    vec_free(ctx->sceneDataBuf);
    for (u32 i = 0; i < SCREEN_Assets_MAX; ++i)
    {
        vec_free(ctx->assetGpuData + i);
    }
    free(ctx);
    ctx = NULL;
}












static void SCREEN_assetDevOnEnter(u32 ai)
{
    SCREEN_AssetDev* dev = ctx->asset + ai;
    const SCREEN_Asset* desc = ctx->scene->asset + ai;
    const char* data = ctx->assetGpuData[ai].data;

    GLenum target = SCREEN_glTargetTextureFromAssetType(desc->type);

    u32 w = desc->size[0];
    u32 h = desc->size[1];
    u32 d = desc->size[2];

    GLenum internalFormat;
    GLenum format;
    switch (desc->components)
    {
    case 1:
    {
        internalFormat = GL_R8;
        format = GL_RED;
        break;
    }
    case 3:
    {
        internalFormat = GL_RGB8;
        format = GL_RGB;
        break;
    }
    case 4:
    {
        internalFormat = GL_RGBA8;
        format = GL_RGBA;
        break;
    }
    default:
        assert(false);
        break;
    }
    GLenum type = GL_UNSIGNED_BYTE;
    GLsizei levels = (GLsizei)floor(log2(max(max(w, h), d)) + 1);

    glGenTextures(1, &dev->texture);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(target, dev->texture);
    glTexParameteri(target, GL_TEXTURE_BASE_LEVEL, 0);
    glTexParameteri(target, GL_TEXTURE_MAX_LEVEL, 1000);

    glBindTexture(target, dev->texture);
    switch (target)
    {
    case GL_TEXTURE_2D:
    {
        glTexStorage2D(target, levels, internalFormat, w, h);
        glTexSubImage2D(target, 0, 0, 0, w, h, format, type, data);
        break;
    }
    case GL_TEXTURE_3D:
    {
        glTexStorage3D(target, levels, internalFormat, w, h, d);
        glTexSubImage3D(target, 0, 0, 0, 0, w, h, d, format, type, data);
        break;
    }
    case GL_TEXTURE_CUBE_MAP:
    {
        glTexStorage2D(target, levels, internalFormat, w, h);
        u32 faceSize = w * h * desc->components;
        for (u32 f = 0; f < 6; ++f)
        {
            glTexSubImage2D
            (
                GL_TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, 0, 0, w, h, format, type, data + faceSize * f
            );
        }
        break;
    }
    default:
        assert(false);
        break;
    }
    SCREEN_GL_CHECK();

    glGenerateMipmap(target);
    SCREEN_GL_CHECK();
}
















static void SCREEN_renderPassDevOnEnter(SCREEN_RenderPassDev* dev, const SCREEN_RenderPass* desc, bool noTex)
{
    assert(!dev->entered);
    dev->entered = true;

    vec_resize(ctx->tmpDataBuf, 0);
    for (u32 ci = 0; ci < SCREEN_Channels_MAX; ++ci)
    {
#ifdef SCREEN_SCENE_STRICT
        if (SCREEN_ChannelType_Unused == desc->channel[ci].type)
        {
            continue;
        }
#endif
        const char* samplerStr = "sampler2D";
        if (SCREEN_ChannelType_Asset == desc->channel[ci].type)
        {
            SCREEN_Asset* asset = ctx->scene->asset + desc->channel[ci].asset;
            if (SCREEN_AssetType_Cube == asset->type)
            {
                samplerStr = "samplerCube";
            }
        }
        char buf[1024];
        u32 n = snprintf(buf, sizeof(buf), "uniform %s iChannel%u;\n", samplerStr, ci);
        vec_pusharr(ctx->tmpDataBuf, buf, n);
    }
    vec_push(ctx->tmpDataBuf, 0);

    const char* commonShader = NULL;
    if (ctx->scene->commonShaderCodeOffset != -1)
    {
        commonShader = ctx->sceneDataBuf->data + ctx->scene->commonShaderCodeOffset;
    }
    GLuint shaderProgram = dev->shaderProgram = SCREEN_buildShaderProgram
    (
        commonShader, ctx->tmpDataBuf->data, ctx->sceneDataBuf->data + desc->shaderCodeOffset
    );
    assert(shaderProgram);

    dev->uniform_Resolution = glGetUniformLocation(shaderProgram, "iResolution");
    dev->uniform_Time = glGetUniformLocation(shaderProgram, "iTime");
    dev->uniform_TimeDelta = glGetUniformLocation(shaderProgram, "iTimeDelta");
    dev->uniform_Mouse = glGetUniformLocation(shaderProgram, "iMouse");
    dev->uniform_Frame = glGetUniformLocation(shaderProgram, "iFrame");
    dev->uniform_Date = glGetUniformLocation(shaderProgram, "iDate");

    for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
    {
        char name[4096] = "";

        snprintf(name, sizeof(name), "iChannel%u", i);
        dev->uniform_Channel[i] = glGetUniformLocation(shaderProgram, name);

        snprintf(name, sizeof(name), "iChannelTime[%u]", i);
        dev->uniform_ChannelTime[i] = glGetUniformLocation(shaderProgram, name);

        snprintf(name, sizeof(name), "iChannelResolution[%u]", i);
        dev->uniform_ChannelResolution[i] = glGetUniformLocation(shaderProgram, name);
    }

    if (!noTex)
    {
        u32 w = ctx->renderWidth;
        u32 h = ctx->renderHeight;
        vec_char* tmpDataBuf = ctx->tmpDataBuf;

        glGenTextures(1, &dev->texture);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, dev->texture);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
        glTexStorage2D(GL_TEXTURE_2D, 1, ctx->textureInternalFormat, w, h);

        vec_resize(tmpDataBuf, w * h * 4);
        memset(tmpDataBuf->data, 0, tmpDataBuf->length);
        glBindTexture(GL_TEXTURE_2D, dev->texture);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, tmpDataBuf->data);
    }
}




static void SCREEN_renderPassDevOnResize
(
    SCREEN_RenderPassDev* dev, const SCREEN_RenderPass* desc, bool noTex, u32 widthCopy, u32 heightCopy
)
{
    if (!dev->entered || noTex)
    {
        if (dev->texture)
        {
            glDeleteTextures(1, &dev->texture);
            dev->texture = 0;
        }
        return;
    }
    u32 w = ctx->renderWidth;
    u32 h = ctx->renderHeight;
    vec_char* tmpDataBuf = ctx->tmpDataBuf;

    GLuint texture0 = dev->texture;
    glGenTextures(1, &dev->texture);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, dev->texture);
    glTexStorage2D(GL_TEXTURE_2D, 1, ctx->textureInternalFormat, w, h);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);

    vec_resize(tmpDataBuf, w * h * 4);
    memset(tmpDataBuf->data, 0, tmpDataBuf->length);
    glBindTexture(GL_TEXTURE_2D, dev->texture);
    glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, tmpDataBuf->data);


    if (widthCopy && heightCopy)
    {
        assert(texture0);
        glBindFramebuffer(GL_READ_FRAMEBUFFER, ctx->fb);
        glFramebufferTexture2D(GL_READ_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, texture0, 0);
        SCREEN_GL_CHECK();
        assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_READ_FRAMEBUFFER));

        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, ctx->fb);
        glFramebufferTexture2D(GL_DRAW_FRAMEBUFFER, GL_COLOR_ATTACHMENT1, GL_TEXTURE_2D, dev->texture, 0);
        SCREEN_GL_CHECK();
        assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER));

        {
            const GLenum bufs[] = { GL_COLOR_ATTACHMENT1 };
            glDrawBuffers(ARYLEN(bufs), bufs);
            SCREEN_GL_CHECK();
        }
        glBlitFramebuffer(0, 0, widthCopy, heightCopy, 0, 0, widthCopy, heightCopy, GL_COLOR_BUFFER_BIT, GL_NEAREST);
        SCREEN_GL_CHECK();
        {
            const GLenum bufs[] = { GL_COLOR_ATTACHMENT0 };
            glDrawBuffers(ARYLEN(bufs), bufs);
            SCREEN_GL_CHECK();
        }
    }
    if (texture0)
    {
        glDeleteTextures(1, &texture0);
    }
}





static void SCREEN_renderPassDevOnRender(SCREEN_RenderPassDev* dev, SCREEN_RenderPass* desc)
{
    if (!dev->entered)
    {
        return;
    }
    assert(dev->shaderProgram);
    SCREEN_GL_CHECK();

    glUseProgram(dev->shaderProgram);
    if (dev->uniform_Resolution >= 0)
    {
        glUniform3f(dev->uniform_Resolution, (f32)ctx->renderWidth, (f32)ctx->renderHeight, 0.f);

    }
    if (dev->uniform_Time >= 0)
    {
        glUniform1f(dev->uniform_Time, ctx->time);
    }
    if (dev->uniform_TimeDelta >= 0)
    {
        glUniform1f(dev->uniform_TimeDelta, ctx->timeDelta);
    }
    if (dev->uniform_Mouse >= 0)
    {
        f32 screenToRender = ctx->screenToRender;
        glUniform4f
        (
            dev->uniform_Mouse,
            (f32)ctx->pointX * screenToRender,
            (f32)(ctx->height - ctx->pointY) * screenToRender,
            (f32)ctx->pointStart[0] * screenToRender,
            (ctx->pointStart[1] > 0)
                ? +(f32)(ctx->height - ctx->pointStart[1]) * screenToRender
                : -(f32)(ctx->height + ctx->pointStart[1]) * screenToRender
        );
    }
    if (dev->uniform_Frame >= 0)
    {
        glUniform1i(dev->uniform_Frame, ctx->frame);
    }
    if (dev->uniform_Date >= 0)
    {
        struct timeval tv[1];
        gettimeofday(tv, NULL);
        time_t tt = time(NULL);
        struct tm* t = localtime(&tt);
        glUniform4f
        (
            dev->uniform_Date,
            (f32)t->tm_year + 1900.0f,
            (f32)t->tm_mon,
            (f32)t->tm_mday,
            t->tm_hour * 60.0f * 60.0f +
            t->tm_min * 60.0f + t->tm_sec + tv->tv_usec * 0.000001f
        );
    }

    for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
    {
        if (dev->uniform_Channel[i] >= 0)
        {
            glUniform1i(dev->uniform_Channel[i], i);
        }
        if (dev->uniform_ChannelTime[i] >= 0)
        {
            glUniform1f(dev->uniform_ChannelTime[i], ctx->time);
        }
        if (dev->uniform_ChannelResolution[i] >= 0)
        {
            glUniform3f(dev->uniform_ChannelResolution[i], (f32)ctx->renderWidth, (f32)ctx->renderHeight, 0.f);
        }
    }
    SCREEN_GL_CHECK();

    if (dev->texture)
    {
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, ctx->fb);
        glFramebufferTexture2D(GL_DRAW_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, dev->texture, 0);
        //assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER));
    }
    else
    {
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
    }
    SCREEN_GL_CHECK();

    for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
    {
        glActiveTexture(GL_TEXTURE0 + i);

        SCREEN_ChannelType type = desc->channel[i].type;
        GLenum target;
        if (SCREEN_ChannelType_Asset == type)
        {
            u32 ai = desc->channel[i].asset;
            target = SCREEN_glTargetTextureFromAssetType(ctx->scene->asset[ai].type);
        }
        else
        {
            target = GL_TEXTURE_2D;
        }

        switch (type)
        {
        case SCREEN_ChannelType_Unused:
        {
            glBindTexture(target, 0);
            continue;
        }
        case SCREEN_ChannelType_Buffer:
        {
            u32 bi = desc->channel[i].buffer;
            GLuint texture = ctx->buffer[bi].texture;
            glBindTexture(target, texture);
            break;
        }
        case SCREEN_ChannelType_Keyboard:
        {
            glBindTexture(target, ctx->texKeyboard);
            break;
        }
        case SCREEN_ChannelType_Asset:
        {
            u32 ai = desc->channel[i].asset;
            GLuint texture = ctx->asset[ai].texture;
            glBindTexture(target, texture);
            break;
        }
        default:
            assert(false);
            break;
        }
        if (type != SCREEN_ChannelType_Unused)
        {
            GLenum wrap = SCREEN_glFilterFromChannelWrap(desc->channel[i].wrap);
            GLenum filterMin = SCREEN_glMinFilterFromChannelFilter(desc->channel[i].filter);
            GLenum filterMag = SCREEN_glMagFilterFromChannelFilter(desc->channel[i].filter);
            glTexParameteri(target, GL_TEXTURE_WRAP_S, wrap);
            glTexParameteri(target, GL_TEXTURE_WRAP_T, wrap);
            glTexParameteri(target, GL_TEXTURE_MIN_FILTER, filterMin);
            glTexParameteri(target, GL_TEXTURE_MAG_FILTER, filterMag);
        }
    }

    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GL_CHECK();
}







static void SCREEN_renderPassDevReset(SCREEN_RenderPassDev* dev, bool noTex)
{
    if (!dev->entered || noTex)
    {
        return;
    }
    if (dev->texture)
    {
        u32 w = ctx->renderWidth;
        u32 h = ctx->renderHeight;
        vec_char* tmpDataBuf = ctx->tmpDataBuf;

        vec_resize(tmpDataBuf, w * h * 4);
        memset(tmpDataBuf->data, 0, tmpDataBuf->length);
        glBindTexture(GL_TEXTURE_2D, dev->texture);
        glTexSubImage2D(GL_TEXTURE_2D, 0, 0, 0, w, h, GL_RGBA, GL_UNSIGNED_BYTE, tmpDataBuf->data);
    }
}














static void SCREEN_enterScene(void)
{
    assert(ctx->entered);
    assert(ctx->sceneLoaded);

    for (u32 i = 0; i < ctx->scene->assetCount; ++i)
    {
        SCREEN_assetDevOnEnter(i);
    }

    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (-1 == ctx->scene->buffer[i].shaderCodeOffset)
        {
            continue;
        }
        SCREEN_RenderPassDev* dev = ctx->buffer + i;
        SCREEN_renderPassDevOnEnter(dev, ctx->scene->buffer + i, false);
    }
    SCREEN_renderPassDevOnEnter(ctx->image, &ctx->scene->image, ctx->imageRenderDirect);

    SCREEN_GL_CHECK();
}


static void SCREEN_leaveScene(void)
{
    for (u32 i = 0; i < ctx->scene->assetCount; ++i)
    {
        SCREEN_AssetDev* dev = ctx->asset + i;
        SCREEN_assetDevOnLeave(dev);
    }
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        SCREEN_RenderPassDev* dev = ctx->buffer + i;
        SCREEN_renderPassDevOnLeave(dev);
    }
    SCREEN_renderPassDevOnLeave(ctx->image);
}











static void SCREEN_calcSceneToRender(void)
{
    f32 screenToRender;
    if (SCREEN_RenderSizeMode_Fixed == ctx->renderSize->mode)
    {
        screenToRender = (f32)ctx->renderSize->size / (f32)min(ctx->width, ctx->height);
    }
    else
    {
        assert(SCREEN_RenderSizeMode_Scale == ctx->renderSize->mode);
        screenToRender = ctx->renderSize->scale;
    }

    f32 v = (f32)max(ctx->width, ctx->height);
    f32 a = (f32)ctx->width / (f32)ctx->height;

    f32 n = v * screenToRender;
    n = max(1, n);
    n = min(8192, n);
    screenToRender = ctx->screenToRender = n / v;

    if (a > 1.f)
    {
        ctx->renderWidth = (u32)ceil(n);
        ctx->renderHeight = (u32)ceil(n / a);
    }
    else
    {
        ctx->renderWidth = (u32)ceil(n * a);
        ctx->renderHeight = (u32)ceil(n);
    }
    if ((ctx->width == ctx->renderWidth) && (ctx->height == ctx->renderHeight))
    {
        ctx->imageRenderDirect = true;
    }
    else
    {
        ctx->imageRenderDirect = false;
    }
}











void SCREEN_enter(u32 w, u32 h)
{
    assert(!ctx->entered);
    ctx->entered = true;

    //printf("GL_VERSION  : %s\n", glGetString(GL_VERSION));
    //printf("GL_RENDERER : %s\n", glGetString(GL_RENDERER));
#ifdef SCREEN_USE_GL3W
    glEnable(GL_TEXTURE_CUBE_MAP_SEAMLESS);
#endif

    assert(w && h);

    if (ctx->width && ctx->height)
    {
        ctx->pointX = (int)((f32)ctx->pointX / ctx->width * w);
        ctx->pointY = (int)((f32)ctx->pointY / ctx->height * h);
        //ctx->pointStart[0] = -ctx->pointX;
        //ctx->pointStart[1] = -ctx->pointY;
    }
    else
    {
        ctx->pointY = h;
    }
    ctx->width = w;
    ctx->height = h;


    SCREEN_calcSceneToRender();


    static const GLfloat vertices[] =
    {
        -1.0f, -1.0f,
         1.0f, -1.0f,
        -1.0f,  1.0f,
        -1.0f,  1.0f,
         1.0f, -1.0f,
         1.0f,  1.0f,
    };
    glGenBuffers(1, &ctx->vb);
    glBindBuffer(GL_ARRAY_BUFFER, ctx->vb);
    glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);

    glGenVertexArrays(1, &ctx->va);
    glBindVertexArray(ctx->va);

    const GLint attrib_position = 0;
    glBindBuffer(GL_ARRAY_BUFFER, ctx->vb);
    glVertexAttribPointer(attrib_position, 2, GL_FLOAT, GL_FALSE, 0, 0);
    glEnableVertexAttribArray(attrib_position);

    SCREEN_GL_CHECK();


    glGenFramebuffers(1, &ctx->fb);


    {
        glGenTextures(1, &ctx->texKeyboard);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, ctx->texKeyboard);
        glTexStorage2D
        (
            GL_TEXTURE_2D, 1, SCREEN_KeyboardTextureFormat, SCREEN_KeyCount, SCREEN_KeyboardStateCount
        );
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_NEAREST);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_NEAREST);

        SCREEN_GL_CHECK();
    }


    if (ctx->sceneLoaded)
    {
        SCREEN_enterScene();
    }

    glBindFramebuffer(GL_READ_FRAMEBUFFER, 0);
    glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
}



void SCREEN_leave(void)
{
    assert(ctx->entered);
    ctx->entered = false;

    SCREEN_leaveScene();

    glDeleteFramebuffers(1, &ctx->fb);
    glDeleteVertexArrays(1, &ctx->va);
    glDeleteBuffers(1, &ctx->vb);
}














void SCREEN_resize(u32 w, u32 h)
{
    assert(ctx->entered);
    if (!w || !h)
    {
        return;
    }
    if ((ctx->width == w) && (ctx->height == h))
    {
        return;
    }
    //SCREEN_leave();
    //SCREEN_enter(w, h);
    //return;

    if (ctx->width && ctx->height)
    {
        ctx->pointX = (int)((f32)ctx->pointX / ctx->width * w);
        ctx->pointY = (int)((f32)ctx->pointY / ctx->height * h);
        //ctx->pointStart[0] = -ctx->pointX;
        //ctx->pointStart[1] = -ctx->pointY;
    }
    else
    {
        ctx->pointY = h;
    }
    ctx->width = w;
    ctx->height = h;

    SCREEN_setRenderSize(ctx->renderSize);
}











static void SCREEN_sceneStateReset(void)
{
    assert(ctx->entered);

    ctx->frame = 0;
    ctx->time = 0;
    ctx->timeDelta = 0;
}

static void SCREEN_inputStateReset(void)
{
    ctx->pointX = 0;
    ctx->pointY = ctx->height;
    ctx->pointStart[0] = ctx->pointX;
    ctx->pointStart[1] = ctx->pointY;
    memset(ctx->keyboardState, 0, sizeof(ctx->keyboardState));
}






void SCREEN_sceneReset(void)
{
    assert(ctx->entered);
    //SCREEN_leaveScene();
    //SCREEN_enterScene();

    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {

        SCREEN_RenderPassDev* passDev = ctx->buffer + i;
        SCREEN_renderPassDevReset(passDev, false);
    }
    SCREEN_renderPassDevReset(ctx->image, ctx->imageRenderDirect);

    SCREEN_sceneStateReset();
}





void SCREEN_frame(f32 dt, bool stopped)
{
    assert(ctx->entered);

    ctx->timeDelta = dt;
    if (!stopped)
    {
        ctx->time += dt;
    }


    glViewport(0, 0, ctx->renderWidth, ctx->renderHeight);
    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);

    if (!ctx->image->shaderProgram)
    {
        return;
    }
    SCREEN_GL_CHECK();

    {
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, ctx->texKeyboard);
        glTexSubImage2D
        (
            GL_TEXTURE_2D, 0, 0, 0,
            SCREEN_KeyCount, SCREEN_KeyboardStateCount,
            SCREEN_KeyboardTextureDataFormat, SCREEN_KeyboardTextureDataType,
            ctx->keyboardState
        );
        SCREEN_GL_CHECK();

        memset(ctx->keyboardState + SCREEN_KeyboardState_KeyPressed, 0, sizeof(*ctx->keyboardState));
    }


    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        SCREEN_renderPassDevOnRender(ctx->buffer + i, ctx->scene->buffer + i);
    }
    SCREEN_renderPassDevOnRender(ctx->image, &ctx->scene->image);

    if (!ctx->imageRenderDirect)
    {
        SCREEN_GL_CHECK();
        glBindFramebuffer(GL_READ_FRAMEBUFFER, ctx->fb);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);

        assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_READ_FRAMEBUFFER));
        assert(GL_FRAMEBUFFER_COMPLETE == glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER));
        //glBlitFramebuffer
        //(
        //    0, 0, ctx->renderWidth, ctx->renderHeight,
        //    0, 0, ctx->renderWidth, ctx->renderHeight,
        //    GL_COLOR_BUFFER_BIT, GL_LINEAR
        //);
        glBlitFramebuffer
        (
            0, 0, ctx->renderWidth, ctx->renderHeight,
            0, 0, ctx->width, ctx->height,
            GL_COLOR_BUFFER_BIT, GL_LINEAR
        );
        SCREEN_GL_CHECK();
    }

    ctx->frame += 1;
}










void SCREEN_mouseUp(s32 x, s32 y)
{
    ctx->pointStart[0] = -ctx->pointStart[0];
    ctx->pointStart[1] = -ctx->pointStart[1];
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseDown(s32 x, s32 y)
{
    ctx->pointStart[0] = x;
    ctx->pointStart[1] = y;
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseMotion(s32 x, s32 y)
{
    ctx->pointX = x;
    ctx->pointY = y;
}



void SCREEN_keyUp(SCREEN_Key k)
{
    assert(k < SCREEN_KeyCount);
    ctx->keyboardState[SCREEN_KeyboardState_KeyDown][k] = 0;
    ctx->keyboardState[SCREEN_KeyboardState_KeyPressed][k] = 0;
}

void SCREEN_keyDown(SCREEN_Key k)
{
    assert(k < SCREEN_KeyCount);
    u8* pDown = ctx->keyboardState[SCREEN_KeyboardState_KeyDown];
    if (!pDown[k])
    {
        ctx->keyboardState[SCREEN_KeyboardState_KeyPressed][k] = 0xff;
        pDown[k] = 0xff;
        u8* pToggle = ctx->keyboardState[SCREEN_KeyboardState_KeyToggle];
        pToggle[k] = pToggle[k] ? 0 : 0xff;
    }
    else
    {
        ctx->keyboardState[SCREEN_KeyboardState_KeyPressed][k] = 0;
    }
}











u32 SCREEN_screenWidth(void)
{
    return ctx->width;
}

u32 SCREEN_screenHeight(void)
{
    return ctx->height;
}

u32 SCREEN_renderWidth(void)
{
    return ctx->renderWidth;
}

u32 SCREEN_renderHeight(void)
{
    return ctx->renderHeight;
}

const SCREEN_RenderSize* SCREEN_renderSize(void)
{
    return ctx->renderSize;
}

void SCREEN_setRenderSize(const SCREEN_RenderSize* rs)
{
    ctx->renderSize[0] = rs[0];

    u32 renderWidth0 = ctx->renderWidth;
    u32 renderHeight0 = ctx->renderHeight;

    SCREEN_calcSceneToRender();

    if ((ctx->renderWidth != renderWidth0) || (ctx->renderHeight != renderHeight0))
    {
        u32 widthCopy = min(ctx->renderWidth, renderWidth0);
        u32 heightCopy = min(ctx->renderHeight, renderHeight0);

        for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
        {
            SCREEN_renderPassDevOnResize(ctx->buffer + i, ctx->scene->buffer + i, false, widthCopy, heightCopy);
        }
        SCREEN_renderPassDevOnResize(ctx->image, &ctx->scene->image, ctx->imageRenderDirect, 0, 0);

        glBindFramebuffer(GL_READ_FRAMEBUFFER, 0);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
    }
}




















































static void SCREEN_loadSceneData(const SCREEN_Scene* scene, const char* sceneData, u32 sceneDataSize)
{
    assert(0 == ctx->sceneDataBuf->length);
    *ctx->scene = *scene;
    vec_pusharr(ctx->sceneDataBuf, sceneData, sceneDataSize);

    assert(SCREEN_calcSceneDataSize(ctx->sceneDataBuf->data, scene) == sceneDataSize);

    for (u32 ai = 0; ai < scene->assetCount; ++ai)
    {
        u32 gpuDataSize = SCREEN_assetGpuDataSize(&scene->asset[ai]);
        vec_resize(ctx->assetGpuData + ai, gpuDataSize);
        SCREEN_assetMakeGpuData(ctx->assetGpuData[ai].data, sceneData, &scene->asset[ai]);
    }
}












bool SCREEN_loadScene(const SCREEN_Scene* scene, const char* sceneData, u32 sceneDataSize)
{
    if (!SCREEN_validateScene(scene))
    {
        return false;
    }
    if (ctx->sceneLoaded)
    {
        SCREEN_unloadScene();
    }
    ctx->sceneLoaded = true;
    SCREEN_loadSceneData(scene, sceneData, sceneDataSize);
    if (ctx->entered)
    {
        SCREEN_enterScene();
    }
    SCREEN_sceneStateReset();
    SCREEN_inputStateReset();
    return true;
}


void SCREEN_unloadScene(void)
{
    if (!ctx->sceneLoaded)
    {
        return;
    }
    ctx->sceneLoaded = false;
    vec_resize(ctx->sceneDataBuf, 0);
    memset(ctx->scene, 0, sizeof(ctx->scene));
    if (ctx->entered)
    {
        SCREEN_leaveScene();
    }
}
































































































































