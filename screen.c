#include "screen_a.h"



typedef struct SCREEN_Context
{
    bool entered;
    SCREEN_BufferRun buffer[SCREEN_Buffers_MAX];
    SCREEN_BufferRun image[1];
    GLuint vb;
    GLuint va;

    GLint uniform_Resolution;
    GLint uniform_Time;
    GLint uniform_Mouse;

    u32 width, height;
    bool pointButtonDown;
    int pointX, pointY;

    bool sceneLoaded;
    vec_char sceneDataBuf[1];
    SCREEN_Scene scene[1];
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








void SCREEN_bufferRunEnter(SCREEN_BufferRun* bufRun, const SCREEN_Buffer* desc)
{
    bufRun->shaderProgram = SCREEN_buildShaderProgram(ctx->scene->shaderComm, desc->shaderCode);
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
        SCREEN_bufferRunEnter(bufRun, ctx->scene->buffer + i);
    }
    SCREEN_bufferRunEnter(ctx->image, &ctx->scene->image);

    if (ctx->image->shaderProgram)
    {
        ctx->uniform_Resolution = glGetUniformLocation(ctx->image->shaderProgram, "iResolution");
        ctx->uniform_Time = glGetUniformLocation(ctx->image->shaderProgram, "iTime");
        ctx->uniform_Mouse = glGetUniformLocation(ctx->image->shaderProgram, "iMouse");
    }
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

    ctx->width = w;
    ctx->height = h;
    glViewport(0, 0, w, h);
    ctx->pointY = ctx->height;

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

    if (ctx->sceneLoaded)
    {
        SCREEN_enterScene();
    }
}



void SCREEN_leave(void)
{
    assert(ctx->entered);
    ctx->entered = false;

    glDeleteVertexArrays(1, &ctx->va);
    glDeleteBuffers(1, &ctx->vb);
    SCREEN_bufferRunLeave(ctx->image);
}



void SCREEN_resize(u32 w, u32 h)
{
    assert(ctx->entered);
    ctx->width = w;
    ctx->height = h;
    glViewport(0, 0, w, h);
    SCREEN_GLCHECK();
    ctx->pointY = ctx->height;
}



void SCREEN_frame(f32 time)
{
    assert(ctx->entered);

    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);

    if (!ctx->image->shaderProgram)
    {
        return;
    }

    if (ctx->uniform_Time >= 0)
    {
        glUniform1f(ctx->uniform_Time, time);
    }
    if (ctx->uniform_Resolution >= 0)
    {
        glUniform3f(ctx->uniform_Resolution, (f32)ctx->width, (f32)ctx->height, 0);
    }
    if (ctx->uniform_Mouse >= 0)
    {
        glUniform4f(ctx->uniform_Mouse, (f32)ctx->pointX, (f32)ctx->height - ctx->pointY, (f32)ctx->width, -(f32)ctx->height);
    }

    glBindVertexArray(ctx->va);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GLCHECK();
}










void SCREEN_mouseUp(int x, int y)
{
    ctx->pointButtonDown = false;
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseDown(int x, int y)
{
    ctx->pointButtonDown = true;
    ctx->pointX = x;
    ctx->pointY = y;
}

void SCREEN_mouseMotion(int x, int y, int dx, int dy)
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
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (srcScene->buffer[i].shaderCode)
        {
            dstScene->buffer[i].shaderCode = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
            u32 n = (u32)strlen(srcScene->buffer[i].shaderCode) + 1;
            vec_pusharr(ctx->sceneDataBuf, srcScene->buffer[i].shaderCode, n);

            for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
            {
                dstScene->buffer[i].channel[i] = srcScene->buffer[i].channel[i];
            }
        }
    }
    if (srcScene->image.shaderCode)
    {
        dstScene->image.shaderCode = ctx->sceneDataBuf->data + ctx->sceneDataBuf->length;
        u32 n = (u32)strlen(srcScene->image.shaderCode) + 1;
        vec_pusharr(ctx->sceneDataBuf, srcScene->image.shaderCode, n);

        for (u32 i = 0; i < SCREEN_Channels_MAX; ++i)
        {
            dstScene->image.channel[i] = srcScene->image.channel[i];
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
































































































































