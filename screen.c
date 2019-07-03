#include "screen_a.h"





typedef struct SCREEN_Context
{
    GLuint shaderProgram;
    GLuint vb;
    GLuint va;

    GLint uniform_Resolution;
    GLint uniform_Time;
    GLint uniform_Mouse;

    f32 width, height;
    bool pointButtonDown;
    f32 pointX, pointY;
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
    free(ctx);
    ctx = NULL;
}






void SCREEN_enter(u32 w, u32 h)
{
    //printf("GL_VERSION  : %s\n", glGetString(GL_VERSION));
    //printf("GL_RENDERER : %s\n", glGetString(GL_RENDERER));

    ctx->width = (f32)w;
    ctx->height = (f32)h;
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
}



void SCREEN_leave(void)
{
    glDeleteVertexArrays(1, &ctx->va);
    glDeleteBuffers(1, &ctx->vb);
    glDeleteProgram(ctx->shaderProgram);
}



void SCREEN_resize(u32 w, u32 h)
{
    ctx->width = (f32)w;
    ctx->height = (f32)h;
    glViewport(0, 0, w, h);
    SCREEN_GLCHECK();
    ctx->pointY = ctx->height;
}



void SCREEN_frame(f32 time)
{
    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);

    if (!ctx->shaderProgram)
    {
        return;
    }

    if (ctx->uniform_Time >= 0)
    {
        glUniform1f(ctx->uniform_Time, time);
    }
    if (ctx->uniform_Resolution >= 0)
    {
        glUniform3f(ctx->uniform_Resolution, ctx->width, ctx->height, 0);
    }
    if (ctx->uniform_Mouse >= 0)
    {
        glUniform4f(ctx->uniform_Mouse, ctx->pointX, ctx->height - ctx->pointY, ctx->width, -ctx->height);
    }

    glBindVertexArray(ctx->va);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GLCHECK();
}





void SCREEN_loadScene(const SCREEN_SceneDesc* desc)
{
    if (ctx->shaderProgram)
    {
        glDeleteProgram(ctx->shaderProgram);
    }
    ctx->shaderProgram = SCREEN_buildShaderProgram(desc->shaderMain);

    if (ctx->shaderProgram)
    {
        ctx->uniform_Resolution = glGetUniformLocation(ctx->shaderProgram, "iResolution");
        ctx->uniform_Time = glGetUniformLocation(ctx->shaderProgram, "iTime");
        ctx->uniform_Mouse = glGetUniformLocation(ctx->shaderProgram, "iMouse");
    }
}


void SCREEN_unloadScene(void)
{
    if (ctx->shaderProgram)
    {
        glDeleteProgram(ctx->shaderProgram);
        ctx->shaderProgram = 0;
    }
}






void SCREEN_mouseUp(int x, int y)
{
    ctx->pointButtonDown = false;
    ctx->pointX = (float)x;
    ctx->pointY = (float)y;
}

void SCREEN_mouseDown(int x, int y)
{
    ctx->pointButtonDown = true;
    ctx->pointX = (float)x;
    ctx->pointY = (float)y;
}

void SCREEN_mouseMotion(int x, int y, int dx, int dy)
{
    ctx->pointX = (float)x;
    ctx->pointY = (float)y;
}

























































































































