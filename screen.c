#include "screen_a.h"



typedef struct SCREEN_Context
{
    bool entered;
    SCREEN_BufferRun buffer[SCREEN_Buffers_MAX];
    SCREEN_BufferRun image[1];
    GLuint vb;
    GLuint va;
    GLuint fb;

    u32 width, height;
    f32 time;
    int pointX, pointY;
    int pointStart[2];
    u32 frame;

    bool sceneLoaded;
    vec_char sceneDataBuf[1];
    SCREEN_Scene scene[1];

    GLuint curShaderProgram;
    GLuint curFramebuffer;
} SCREEN_Context;

SCREEN_Context* ctx = NULL;




void SCREEN_startup(void)
{
#ifdef SCREEN_USE_GL3W
    int err = gl3wInit();
    assert(0 == err);
#endif
    assert(!ctx);
    ctx = (SCREEN_Context*)zalloc(sizeof(*ctx));
}



void SCREEN_destroy(void)
{
    vec_free(ctx->sceneDataBuf);
    free(ctx);
    ctx = NULL;
}








static void SCREEN_bufferRunEnter(SCREEN_BufferRun* b, const SCREEN_Buffer* desc, bool noTex)
{
    assert(!b->entered);
    b->entered = true;

    GLuint shaderProgram = b->shaderProgram = SCREEN_buildShaderProgram(ctx->scene->shaderComm, desc->shaderCode);
    ctx->curShaderProgram = shaderProgram;

    b->uniform_Resolution = glGetUniformLocation(shaderProgram, "iResolution");
    b->uniform_Time = glGetUniformLocation(shaderProgram, "iTime");
    b->uniform_Mouse = glGetUniformLocation(shaderProgram, "iMouse");
    b->uniform_Frame = glGetUniformLocation(shaderProgram, "iFrame");

    for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
    {
        char name[4096] = "";
        snprintf(name, sizeof(name), "iChannel%u", i);
        b->uniform_Channel[i] = glGetUniformLocation(shaderProgram, name);
    }

    if (!noTex)
    {
        glGenTextures(1, &b->texture);

        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, b->texture);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexStorage2D(GL_TEXTURE_2D, 1, GL_RGBA32F, ctx->width, ctx->height);
    }
}




static void SCREEN_bufferRunResize(SCREEN_BufferRun* b, const SCREEN_Buffer* desc, bool noTex)
{
    if (noTex)
    {
        return;
    }
    glDeleteTextures(1, &b->texture);
    glGenTextures(1, &b->texture);

    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, b->texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, 0);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexStorage2D(GL_TEXTURE_2D, 1, GL_RGBA32F, ctx->width, ctx->height);
}







static void SCREEN_enterScene(void)
{
    assert(ctx->entered);
    assert(ctx->sceneLoaded);

    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (!ctx->scene->buffer[i].shaderCode)
        {
            continue;
        }
        SCREEN_BufferRun* bufRun = ctx->buffer + i;
        SCREEN_bufferRunEnter(bufRun, ctx->scene->buffer + i, false);
    }
    SCREEN_bufferRunEnter(ctx->image, &ctx->scene->image, true);

    SCREEN_GLCHECK();
}

static void SCREEN_leaveScene(void)
{
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        SCREEN_BufferRun* bufRun = ctx->buffer + i;
        SCREEN_bufferRunLeave(bufRun);
    }
    SCREEN_bufferRunLeave(ctx->image);
}










void SCREEN_enter(u32 w, u32 h)
{
    assert(!ctx->entered);
    ctx->entered = true;
    //printf("GL_VERSION  : %s\n", glGetString(GL_VERSION));
    //printf("GL_RENDERER : %s\n", glGetString(GL_RENDERER));

    ctx->pointX = (int)((f32)ctx->pointX / ctx->width * w);
    ctx->pointY = (int)((f32)ctx->pointY / ctx->height * h);
    ctx->width = w;
    ctx->height = h;
    glViewport(0, 0, w, h);

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

    SCREEN_GLCHECK();


    glGenFramebuffers(1, &ctx->fb);


    if (ctx->sceneLoaded)
    {
        SCREEN_enterScene();
    }
}



void SCREEN_leave(void)
{
    assert(ctx->entered);
    ctx->entered = false;

    glDeleteFramebuffers(1, &ctx->fb);
    glDeleteVertexArrays(1, &ctx->va);
    glDeleteBuffers(1, &ctx->vb);
    SCREEN_bufferRunLeave(ctx->image);

    ctx->curShaderProgram = 0;
}








void SCREEN_resize(u32 w, u32 h)
{
    assert(ctx->entered);
    if ((ctx->width == w) && (ctx->height == h))
    {
        return;
    }
    ctx->pointX = (int)((f32)ctx->pointX / ctx->width * w);
    ctx->pointY = (int)((f32)ctx->pointY / ctx->height * h);
    ctx->width = w;
    ctx->height = h;
    glViewport(0, 0, w, h);
    SCREEN_GLCHECK();

    glDeleteFramebuffers(1, &ctx->fb);
    glGenFramebuffers(1, &ctx->fb);
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        SCREEN_bufferRunResize(ctx->buffer + i, ctx->scene->buffer + i, false);
    }
    SCREEN_bufferRunResize(ctx->image, &ctx->scene->image, true);
}









static void SCREEN_bufferRunRender(SCREEN_BufferRun* b, SCREEN_Buffer* desc)
{
    if (!b->shaderProgram)
    {
        return;
    }
    if (b->shaderProgram != ctx->curShaderProgram)
    {
        ctx->curShaderProgram = b->shaderProgram;
        glUseProgram(b->shaderProgram);
    }
    if (b->uniform_Resolution >= 0)
    {
        glUniform3f(b->uniform_Resolution, (f32)ctx->width, (f32)ctx->height, 0.f);
        
    }
    if (b->uniform_Time >= 0)
    {
        glUniform1f(b->uniform_Time, ctx->time);
    }
    if (b->uniform_Mouse >= 0)
    {
        glUniform4f
        (
            b->uniform_Mouse,
            (f32)ctx->pointX, (f32)ctx->height - ctx->pointY,
            (f32)ctx->pointStart[0], (f32)ctx->pointStart[1]
        );
    }
    if (b->uniform_Frame >= 0)
    {
        glUniform1i(b->uniform_Frame, ctx->frame);
    }

    if (b->texture)
    {
        if (ctx->curFramebuffer != ctx->fb)
        {
            ctx->curFramebuffer = ctx->fb;
            glBindFramebuffer(GL_FRAMEBUFFER, ctx->fb);
        }
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, b->texture, 0);
        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE)
        {
            // todo error report
            return;
        }
    }
    else
    {
        if (ctx->curFramebuffer != 0)
        {
            ctx->curFramebuffer = 0;
            glBindFramebuffer(GL_FRAMEBUFFER, 0);
        }
    }
    SCREEN_GLCHECK();

    for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
    {
        if (SCREEN_ChannelType_Unused == desc->channel[i].type)
        {
            continue;
        }
        assert(SCREEN_ChannelType_Buffer == desc->channel[i].type);
        glActiveTexture(GL_TEXTURE0 + i);
        GLuint texture = ctx->buffer[desc->channel[i].buffer].texture;
        glBindTexture(GL_TEXTURE_2D, texture);

        if (b->uniform_Channel[i] >= 0)
        {
            glUniform1i(b->uniform_Channel[i], i);
        }
    }

    glBindVertexArray(ctx->va);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GLCHECK();
}













void SCREEN_frame(f32 time)
{
    assert(ctx->entered);

    ctx->time = time;

    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);
    SCREEN_GLCHECK();

    if (!ctx->image->shaderProgram)
    {
        return;
    }
    SCREEN_GLCHECK();

    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        SCREEN_bufferRunRender(ctx->buffer + i, ctx->scene->buffer + i);
    }
    SCREEN_bufferRunRender(ctx->image, &ctx->scene->image);

    ctx->frame += 1;
}










void SCREEN_mouseUp(int x, int y)
{
    ctx->pointStart[0] = -ctx->pointStart[0];
    ctx->pointStart[1] = -ctx->pointStart[1];
    //ctx->pointX = x;
    //ctx->pointY = y;
}

void SCREEN_mouseDown(int x, int y)
{
    ctx->pointStart[0] = x;
    ctx->pointStart[1] = y;
    //ctx->pointX = x;
    //ctx->pointY = y;
}

void SCREEN_mouseMotion(int x, int y)
{
    ctx->pointX = x;
    ctx->pointY = y;
}











static void SCREEN_loadSceneData(const SCREEN_Scene* srcScene)
{
    assert(0 == ctx->sceneDataBuf->length);
    SCREEN_Scene* dstScene = ctx->scene;
    u32 dataSize = SCREEN_calcSceneDataSize(srcScene);
    vec_reserve(ctx->sceneDataBuf, dataSize);

    if (srcScene->shaderComm)
    {
        dstScene->shaderComm = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
        u32 n = (u32)strlen(srcScene->shaderComm) + 1;
        vec_pusharr(ctx->sceneDataBuf, srcScene->shaderComm, n);
    }
    for (u32 bi = 0; bi < SCREEN_Buffers_MAX; ++bi)
    {
        const SCREEN_Buffer* srcBuffer = srcScene->buffer + bi;
        if (srcBuffer->shaderCode)
        {
            SCREEN_Buffer* dstBuffer = dstScene->buffer + bi;
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
    if (ctx->entered)
    {
        SCREEN_leaveScene();
    }
}
































































































































