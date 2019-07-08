#include "screen_a.h"




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
    SCREEN_RenderPassDev buffer2d[SCREEN_Buffer2Ds_MAX];
    SCREEN_RenderPassDev image[1];
    GLuint vb;
    GLuint va;
    GLuint fb;

    // scene context
    u32 frame;
    f32 time;
    f32 timeDelta;
    // screen space
    int pointX, pointY;
    int pointStart[2];

    // data buffer
    vec_char sceneDataBuf[1];
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
    vec_free(ctx->sceneDataBuf);
    free(ctx);
    ctx = NULL;
}








static void SCREEN_renderPassDevOnEnter(SCREEN_RenderPassDev* dev, const SCREEN_RenderPass* desc, bool noTex)
{
    assert(!dev->entered);
    dev->entered = true;

    GLuint shaderProgram = dev->shaderProgram = SCREEN_buildShaderProgram(ctx->scene->shaderCommon, desc->shaderCode);
    assert(shaderProgram);

    dev->uniform_Resolution = glGetUniformLocation(shaderProgram, "iResolution");
    dev->uniform_Time = glGetUniformLocation(shaderProgram, "iTime");
    dev->uniform_TimeDelta = glGetUniformLocation(shaderProgram, "iTimeDelta");
    dev->uniform_Mouse = glGetUniformLocation(shaderProgram, "iMouse");
    dev->uniform_Frame = glGetUniformLocation(shaderProgram, "iFrame");

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
        glGenTextures(1, &dev->texture);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, dev->texture);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexStorage2D(GL_TEXTURE_2D, 1, ctx->textureInternalFormat, ctx->renderWidth, ctx->renderHeight);
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
    GLuint texture0 = dev->texture;
    glGenTextures(1, &dev->texture);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, dev->texture);
    glTexStorage2D(GL_TEXTURE_2D, 1, ctx->textureInternalFormat, ctx->renderWidth, ctx->renderHeight);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

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
        if (SCREEN_ChannelType_Unused == desc->channel[i].type)
        {
            //glActiveTexture(GL_TEXTURE0 + i);
            //glBindTexture(GL_TEXTURE_2D, 0);
            continue;
        }
        assert(SCREEN_ChannelType_Buffer2D == desc->channel[i].type);
        glActiveTexture(GL_TEXTURE0 + i);
        GLuint texture = ctx->buffer2d[desc->channel[i].buffer2d].texture;
        glBindTexture(GL_TEXTURE_2D, texture);
    }

    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GL_CHECK();
}













static void SCREEN_enterScene(void)
{
    assert(ctx->entered);
    assert(ctx->sceneLoaded);

    for (u32 i = 0; i < SCREEN_Buffer2Ds_MAX; ++i)
    {
        if (!ctx->scene->buffer2d[i].shaderCode)
        {
            continue;
        }
        SCREEN_RenderPassDev* passDev = ctx->buffer2d + i;
        SCREEN_renderPassDevOnEnter(passDev, ctx->scene->buffer2d + i, false);
    }
    SCREEN_renderPassDevOnEnter(ctx->image, &ctx->scene->image, ctx->imageRenderDirect);

    SCREEN_GL_CHECK();
}

static void SCREEN_leaveScene(void)
{
    for (u32 i = 0; i < SCREEN_Buffer2Ds_MAX; ++i)
    {
        SCREEN_RenderPassDev* passDev = ctx->buffer2d + i;
        SCREEN_renderPassDevOnLeave(passDev);
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









void SCREEN_frame(f32 dt)
{
    assert(ctx->entered);

    ctx->timeDelta = dt;
    ctx->time += dt;

    glViewport(0, 0, ctx->renderWidth, ctx->renderHeight);
    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);
    SCREEN_GL_CHECK();

    if (!ctx->image->shaderProgram)
    {
        return;
    }
    SCREEN_GL_CHECK();

    for (u32 i = 0; i < SCREEN_Buffer2Ds_MAX; ++i)
    {
        SCREEN_renderPassDevOnRender(ctx->buffer2d + i, ctx->scene->buffer2d + i);
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










void SCREEN_mouseUp(int x, int y)
{
    ctx->pointStart[0] = -ctx->pointStart[0];
    ctx->pointStart[1] = -ctx->pointStart[1];
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseDown(int x, int y)
{
    ctx->pointStart[0] = x;
    ctx->pointStart[1] = y;
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseMotion(int x, int y)
{
    ctx->pointX = x;
    ctx->pointY = y;
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

        for (u32 i = 0; i < SCREEN_Buffer2Ds_MAX; ++i)
        {
            SCREEN_renderPassDevOnResize(ctx->buffer2d + i, ctx->scene->buffer2d + i, false, widthCopy, heightCopy);
        }
        SCREEN_renderPassDevOnResize(ctx->image, &ctx->scene->image, ctx->imageRenderDirect, 0, 0);

        glBindFramebuffer(GL_READ_FRAMEBUFFER, 0);
        glBindFramebuffer(GL_DRAW_FRAMEBUFFER, 0);
    }
}




















































static void SCREEN_loadSceneData(const SCREEN_Scene* srcScene)
{
    assert(0 == ctx->sceneDataBuf->length);
    SCREEN_Scene* dstScene = ctx->scene;
    u32 dataSize = SCREEN_calcSceneDataSize(srcScene);
    vec_reserve(ctx->sceneDataBuf, dataSize);

    if (srcScene->shaderCommon)
    {
        dstScene->shaderCommon = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
        u32 n = (u32)strlen(srcScene->shaderCommon) + 1;
        vec_pusharr(ctx->sceneDataBuf, srcScene->shaderCommon, n);
    }
    for (u32 bi = 0; bi < SCREEN_Buffer2Ds_MAX; ++bi)
    {
        const SCREEN_RenderPass* srcBuffer = srcScene->buffer2d + bi;
        if (srcBuffer->shaderCode)
        {
            SCREEN_RenderPass* dstBuffer = dstScene->buffer2d + bi;
            dstBuffer->shaderCode = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
            u32 n = (u32)strlen(srcBuffer->shaderCode) + 1;
            vec_pusharr(ctx->sceneDataBuf, srcBuffer->shaderCode, n);

            for (u32 ci = 0; ci < SCREEN_Channels_MAX; ++ci)
            {
                dstBuffer->channel[ci] = srcBuffer->channel[ci];
            }
        }
    }
    if (srcScene->image.shaderCode)
    {
        dstScene->image.shaderCode = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
        u32 n = (u32)strlen(srcScene->image.shaderCode) + 1;
        vec_pusharr(ctx->sceneDataBuf, srcScene->image.shaderCode, n);

        for (u32 ci = 0; ci < SCREEN_Channels_MAX; ++ci)
        {
            dstScene->image.channel[ci] = srcScene->image.channel[ci];
        }
    }
    assert(ctx->sceneDataBuf->length == dataSize);
}












bool SCREEN_loadScene(const SCREEN_Scene* scene)
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
    SCREEN_loadSceneData(scene);
    if (ctx->entered)
    {
        SCREEN_enterScene();
    }
    ctx->frame = 0;
    ctx->time = 0;
    ctx->timeDelta = 0;
    ctx->pointX = 0;
    ctx->pointY = ctx->height;
    ctx->pointStart[0] = ctx->pointX;
    ctx->pointStart[1] = ctx->pointY;
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
































































































































