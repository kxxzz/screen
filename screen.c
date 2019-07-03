#include "screen_a.h"



const char* SCREEN_shaderCommonSrcHeader(void);
const char* SCREEN_shaderVertexSrc(void);
const char* SCREEN_shaderFragmentSrcHeader(void);
const char* SCREEN_shaderFragmentSrcFooter(void);



typedef struct SCREEN_Context
{
    f32 width, height;
    GLuint shaderProgram;
    GLuint vb;
    GLuint va;

    GLint uniform_Resolution;
    GLint uniform_Time;
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


    const char* shaderMain =
        "void mainImage(out vec4 fragColor, in vec2 fragCoord)\n"
        "{\n"
        "    vec2 uv=fragCoord.xy/iResolution.xy;\n"
        "    fragColor = vec4(uv, 0.5+0.5*sin(iTime), 1.0);\n"
        "}\n";

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
    SCREEN_GLCHECK();


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

    GLint attrib_position = glGetAttribLocation(shaderProgram, "vPosition");

    glBindBuffer(GL_ARRAY_BUFFER, ctx->vb);
    glVertexAttribPointer(attrib_position, 2, GL_FLOAT, GL_FALSE, 0, 0);
    glEnableVertexAttribArray(attrib_position);


    ctx->uniform_Resolution = glGetUniformLocation(shaderProgram, "iResolution");
    ctx->uniform_Time = glGetUniformLocation(shaderProgram, "iTime");


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
}



void SCREEN_frame(f32 time)
{
    glClearColor(0.0f, 0.0f, 1.0f, 1.0);
    glClear(GL_COLOR_BUFFER_BIT);

    if (ctx->uniform_Time >= 0)
    {
        glUniform1f(ctx->uniform_Time, time);
    }
    if (ctx->uniform_Resolution >= 0)
    {
        glUniform3f(ctx->uniform_Resolution, ctx->width, ctx->height, 0);
    }
    glBindVertexArray(ctx->va);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    SCREEN_GLCHECK();
}





































































































































