#pragma warning(disable: 4101)

#include <stdlib.h>
#ifdef _WIN32
# include <crtdbg.h>
#endif

#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <time.h>

#include <sys/stat.h>
#include <signal.h>

#define HAVE_M_PI
#define SDL_MAIN_HANDLED
#include <SDL.h>

#include <screen.h>

#include <argparse.h>
#include <fileu.h>



static int mainReturn(int r)
{
#if !defined(NDEBUG) && defined(_WIN32)
    system("pause");
#endif
    return r;
}





enum
{
    TimeStrBuf_MAX = 16,
};

static char* nowStr(char* timeBuf)
{
    time_t t = time(NULL);
    struct tm *lt = localtime(&t);
    timeBuf[strftime(timeBuf, TimeStrBuf_MAX, "%H:%M:%S", lt)] = '\0';
    return timeBuf;
}




static void loadSceneByFile(const char* filename)
{
    char* src;
    u32 srcSize = FILEU_readFile(filename, &src);
    if (-1 == srcSize)
    {
        return;
    }
    SCREEN_SceneDesc desc = { src };
    SCREEN_loadScene(&desc);
    free(src);
}







int main(int argc, char* argv[])
{
#if !defined(NDEBUG) && defined(_WIN32)
    _CrtSetDbgFlag(_CRTDBG_ALLOC_MEM_DF | _CRTDBG_LEAK_CHECK_DF);
#endif

    char timeBuf[TimeStrBuf_MAX];


    char* srcFile = NULL;
    int watchFlag = false;
    struct argparse_option options[] =
    {
        OPT_HELP(),
        //OPT_GROUP("Basic options"),
        OPT_STRING('f', "file", &srcFile, "file to open"),
        OPT_BOOLEAN('w', "watch", &watchFlag, "watch file and reload it when it changes"),
        OPT_END(),
    };
    struct argparse argparse;
    argparse_init(&argparse, options, NULL, 0);
    argc = argparse_parse(&argparse, argc, argv);


    SDL_Init(SDL_INIT_VIDEO);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_ACCELERATED_VISUAL, 1);
    SDL_GL_SetAttribute(SDL_GL_RED_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_GREEN_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_BLUE_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_ALPHA_SIZE, 8);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 16);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 4);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 6);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_CORE);
    SDL_GL_SetAttribute(SDL_GL_MULTISAMPLESAMPLES, 4);
    //SDL_GL_SetSwapInterval(0);

    u32 winWidth = 800;
    u32 winHeight = 600;
    SDL_Window* window = SDL_CreateWindow
    (
        "PLAYER",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, winWidth, winHeight,
        SDL_WINDOW_SHOWN | SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE
    );
    SDL_GLContext context = SDL_GL_CreateContext(window);
    SCREEN_startup();
    SCREEN_enter(winWidth, winHeight);


    time_t lastMtime;
    if (srcFile)
    {
        struct stat st;
        stat(srcFile, &st);
        lastMtime = st.st_mtime;
        loadSceneByFile(srcFile);
    }


    bool quit = false;
    SDL_Event e;
    while (!quit)
    {
        while (SDL_PollEvent(&e))
        {
            switch (e.type)
            {
            case SDL_WINDOWEVENT:
            {
                switch (e.window.event)
                {
                case SDL_WINDOWEVENT_RESIZED:
                case SDL_WINDOWEVENT_SIZE_CHANGED:
                {
                    SCREEN_resize(e.window.data1, e.window.data2);
                    break;
                }
                }
                break;
            }
            case SDL_QUIT:
            {
                quit = true;
                break;
            }
            default:
                break;
            }
        }
        f32 gtime = (f32)SDL_GetTicks() / 1000.f;
        SCREEN_frame(gtime);
        SDL_GL_SwapWindow(window);
        // SDL_Delay(1);

        if (srcFile && watchFlag)
        {
            struct stat st;
            stat(srcFile, &st);
            if (lastMtime != st.st_mtime)
            {
                printf("[CHANGE] \"%s\" [%s]\n", srcFile, nowStr(timeBuf));
                loadSceneByFile(srcFile);
            }
            lastMtime = st.st_mtime;
        }
    }


    SCREEN_destroy();
    SDL_GL_DeleteContext(context);
    SDL_DestroyWindow(window);
    SDL_Quit();

    return mainReturn(EXIT_SUCCESS);
}






























































