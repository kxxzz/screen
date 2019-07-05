#pragma warning(disable: 4101)

#include <stdlib.h>
#ifdef _WIN32
# include <crtdbg.h>
#endif

#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <ctype.h>

#include <sys/stat.h>
#include <signal.h>

#define HAVE_M_PI
#define SDL_MAIN_HANDLED
#include <SDL.h>

#include <screen.h>

#include <argparse.h>
#include <fileu.h>
#include <vec.h>

#include <cJSON.h>




#ifdef ARYLEN
# undef ARYLEN
#endif
#define ARYLEN(a) (sizeof(a) / sizeof((a)[0]))


#ifdef max
# undef max
#endif
#ifdef min
# undef min
#endif
#define max(a,b) ((a) > (b) ? (a) : (b))
#define min(a,b) ((a) < (b) ? (a) : (b))


#define zalloc(sz) calloc(1, sz)


static int strcicmp(const char* a, const char* b)
{
    for (;; ++a, ++b)
    {
        int n = tolower(*a) - tolower(*b);
        if (n || !*a || !*b) return n;
    }
}


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
    PATH_MAX = 260,
};

static char* nowStr(char* timeBuf)
{
    time_t t = time(NULL);
    struct tm *lt = localtime(&t);
    timeBuf[strftime(timeBuf, TimeStrBuf_MAX, "%H:%M:%S", lt)] = '\0';
    return timeBuf;
}





static u32 loadFileDataToBuf(vec_char* dataBuf, const char* filename)
{
    u32 size = FILEU_readFile(filename, NULL, 0);
    if ((-1 == size) || !size)
    {
        // todo report error
        return -1;
    }
    u32 offset = dataBuf->length;
    vec_resize(dataBuf, dataBuf->length + size + 1);
    size = FILEU_readFile(filename, dataBuf->data + offset, size);
    dataBuf->data[offset + size] = 0;
    return offset;
}


static void loadSceneByJson(const char* code, const char* dir, SCREEN_Scene* desc)
{
    vec_char dataBuf[1] = { 0 };
    char path[PATH_MAX] = "";
    u32 commShaderOff = -1, imageShaderOff = -1;
    bool bufferUsed[SCREEN_Buffers_MAX] = { 0 };
    u32 bufferShaderOff[SCREEN_Buffers_MAX] = { 0 };

    cJSON* root = cJSON_Parse(code);
    if (!root)
    {
        const char *error_ptr = cJSON_GetErrorPtr();
        // todo report error
        return;
    }
    {
        cJSON* shader = cJSON_GetObjectItem(root, "commonShader");
        if (shader)
        {
            if (!cJSON_IsString(shader))
            {
                // todo report error
                goto error;
            }
            char* filename = cJSON_GetStringValue(shader);
            snprintf(path, sizeof(path), "%s/%s", dir, filename);
            u32 off = loadFileDataToBuf(dataBuf, path);
            if (-1 == off)
            {
                // todo report error
                goto error;
            }
            commShaderOff = off;
        }
    }
    cJSON* buffers = cJSON_GetObjectItem(root, "buffers");
    if (buffers)
    {
        if (!cJSON_IsArray(buffers))
        {
            // todo report error
            goto error;
        }
        cJSON *buffer, *channel;
        u32 bi = 0;
        cJSON_ArrayForEach(buffer, buffers)
        {
            if (bi >= SCREEN_Buffers_MAX)
            {
                // todo report error
                goto error;
            }
            if (!cJSON_IsObject(buffer) && !cJSON_IsNull(buffer))
            {
                // todo report error
                goto error;
            }
            if (cJSON_IsNull(buffer))
            {
                ++bi;
                continue;
            }
            cJSON* shader = cJSON_GetObjectItem(buffer, "shader");
            if (!cJSON_IsString(shader))
            {
                // todo report error
                goto error;
            }
            char* filename = cJSON_GetStringValue(shader);
            snprintf(path, sizeof(path), "%s/%s", dir, filename);
            u32 off = loadFileDataToBuf(dataBuf, path);
            if (-1 == off)
            {
                // todo report error
                goto error;
            }
            bufferShaderOff[bi] = off;
            bufferUsed[bi] = true;

            cJSON* channels = cJSON_GetObjectItem(buffer, "channels");
            if (channels)
            {
                if (!cJSON_IsArray(channels))
                {
                    // todo report error
                    goto error;
                }
                u32 ci = 0;
                cJSON_ArrayForEach(channel, channels)
                {
                    if (ci >= SCREEN_Channels_MAX)
                    {
                        // todo report error
                        goto error;
                    }
                    if (!cJSON_IsObject(channel) && !cJSON_IsNull(channel))
                    {
                        // todo report error
                        goto error;
                    }
                    if (cJSON_IsNull(channel))
                    {
                        ++ci;
                        continue;
                    }
                    cJSON* type = cJSON_GetObjectItem(channel, "type");
                    if (!cJSON_IsString(type))
                    {
                        // todo report error
                        goto error;
                    }
                    char* typeStr = cJSON_GetStringValue(type);
                    if (0 == strcicmp(typeStr, "buffer"))
                    {
                        desc->buffer[bi].channel[ci].type = SCREEN_ChannelType_Buffer;

                        cJSON* bufferId = cJSON_GetObjectItem(channel, "buffer");
                        if (!cJSON_IsNumber(bufferId))
                        {
                            // todo report error
                            goto error;
                        }
                        u32 id = bufferId->valueint;
                        desc->buffer[bi].channel[ci].buffer = id;
                    }
                    else
                    {
                        // todo report error
                        goto error;
                    }
                    ++ci;
                }
            }
            ++bi;
        }
    }

    cJSON* image = cJSON_GetObjectItem(root, "image");
    if (!cJSON_IsObject(image))
    {
        // todo report error
        goto error;
    }
    {
        cJSON* shader = cJSON_GetObjectItem(image, "shader");
        if (!cJSON_IsString(shader))
        {
            // todo report error
            goto error;
        }
        char* filename = cJSON_GetStringValue(shader);
        snprintf(path, sizeof(path), "%s/%s", dir, filename);
        u32 off = loadFileDataToBuf(dataBuf, path);
        if (-1 == off)
        {
            // todo report error
            goto error;
        }
        imageShaderOff = off;

        cJSON* channels = cJSON_GetObjectItem(image, "channels");
        if (channels)
        {
            if (!cJSON_IsArray(channels))
            {
                // todo report error
                goto error;
            }
            cJSON* channel;
            u32 ci = 0;
            cJSON_ArrayForEach(channel, channels)
            {
                if (ci >= SCREEN_Channels_MAX)
                {
                    // todo report error
                    goto error;
                }
                if (!cJSON_IsObject(channel) && !cJSON_IsNull(channel))
                {
                    // todo report error
                    goto error;
                }
                if (cJSON_IsNull(channel))
                {
                    ++ci;
                    continue;
                }

                cJSON* type = cJSON_GetObjectItem(channel, "type");
                if (!cJSON_IsString(type))
                {
                    // todo report error
                    goto error;
                }
                char* typeStr = cJSON_GetStringValue(type);
                if (0 == strcicmp(typeStr, "buffer"))
                {
                    desc->image.channel[ci].type = SCREEN_ChannelType_Buffer;

                    cJSON* bufferId = cJSON_GetObjectItem(channel, "buffer");
                    if (!cJSON_IsNumber(bufferId))
                    {
                        // todo report error
                        goto error;
                    }
                    u32 id = bufferId->valueint;
                    desc->image.channel[ci].buffer = id;
                }
                else
                {
                    // todo report error
                    goto error;
                }
                ++ci;
            }
        }
    }
    if (commShaderOff != -1)
    {
        desc->shaderComm = dataBuf->data + commShaderOff;
    }
    for (u32 i = 0; i < SCREEN_Buffers_MAX; ++i)
    {
        if (bufferUsed[i])
        {
            desc->buffer[i].shaderCode = dataBuf->data + bufferShaderOff[i];
        }
    }
    desc->image.shaderCode = dataBuf->data + imageShaderOff;

    SCREEN_loadScene(desc);

    vec_free(dataBuf);
    cJSON_Delete(root);
    return;
error:
    vec_free(dataBuf);
    cJSON_Delete(root);
}



static void loadSceneByFile(const char* filename)
{
    SCREEN_Scene desc[1] = { 0 };
    if (FILEU_fileExist(filename))
    {
        if (0 == strcicmp(FILEU_filenameExt(filename), "frag"))
        {
            u32 size = FILEU_readFile(filename, NULL, 0);
            if ((-1 == size) || !size)
            {
                // todo report error
                return;
            }
            char* buf = malloc(size + 1);
            size = FILEU_readFile(filename, buf, size);
            buf[size] = 0;
            desc->image.shaderCode = buf;
            SCREEN_loadScene(desc);
            free(buf);
        }
        else if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
        {
            u32 size = FILEU_readFile(filename, NULL, 0);
            if ((-1 == size) || !size)
            {
                // todo report error
                return;
            }
            char* buf = malloc(size + 1);
            size = FILEU_readFile(filename, buf, size);
            buf[size] = 0;

            char dir[PATH_MAX];
            FILEU_getDirName(dir, filename, sizeof(dir));
            loadSceneByJson(buf, dir, desc);
            free(buf);
        }
    }
    else if (FILEU_dirExist(filename))
    {
        // todo
    }
    else
    {
        // todo report error
    }
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

    u32 winWidth = 800;
    u32 winHeight = 600;
    SDL_Window* window = SDL_CreateWindow
    (
        "SCREEN PLAYER",
        SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, winWidth, winHeight,
        SDL_WINDOW_SHOWN | SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE
    );
    SDL_GLContext context = SDL_GL_CreateContext(window);
    SCREEN_startup();
    SCREEN_enter(winWidth, winHeight);


    u32 intervalMode = 2;
    bool fullscreen = false;
    bool lazyMode = false;
    f32 sceneTime = 0;


    static const int IntervalTable[] = { 0, 1, -1 };
    int r = SDL_GL_SetSwapInterval(IntervalTable[intervalMode]);
    assert(0 == r);


    time_t lastMtime;
    if (srcFile)
    {
        struct stat st;
        stat(srcFile, &st);
        lastMtime = st.st_mtime;
        loadSceneByFile(srcFile);
    }


    f32 now1 = (f32)SDL_GetTicks() / 1000.f;
    f32 lastCheckTime = 0;
    u32 frameCount = 0;
    bool outdated = true;


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
                    outdated = true;
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
            case SDL_MOUSEBUTTONUP:
            {
                outdated = true;
                //SDL_SetRelativeMouseMode(false);

                SCREEN_mouseUp(e.button.x, e.button.y);
                break;
            }
            case SDL_MOUSEBUTTONDOWN:
            {
                outdated = true;
                //SDL_SetRelativeMouseMode(true);

                SCREEN_mouseDown(e.button.x, e.button.y);
                break;
            }
            case SDL_MOUSEMOTION:
            {
                if (e.motion.state > 0)
                {
                    outdated = true;
                    SCREEN_mouseMotion(e.button.x, e.button.y, e.motion.xrel, e.motion.yrel);
                }
                break;
            }
            case SDL_KEYDOWN:
            {
                outdated = true;
                if (SDLK_BACKSPACE == e.key.keysym.sym)
                {
                    fullscreen = !fullscreen;
                    SDL_SetWindowFullscreen(window, fullscreen ? SDL_WINDOW_FULLSCREEN_DESKTOP : 0);
                }
                if (SDLK_TAB == e.key.keysym.sym)
                {
                    intervalMode = ++intervalMode % ARYLEN(IntervalTable);
                    int r = SDL_GL_SetSwapInterval(intervalMode);
                    if (0 != r)
                    {
                        // todo
                    }
                }
                if (SDLK_SPACE == e.key.keysym.sym)
                {
                    lazyMode = !lazyMode;
                }
                break;
            }
            case SDL_KEYUP:
            {
                break;
            }
            default:
                break;
            }
        }


        if (srcFile && watchFlag && (now1 - lastCheckTime > 0.25f))
        {
            static char title[255] = "";
            snprintf(title, sizeof(title), "SCREEN PLAYER%*c FPS: %-2.2f", 16, ' ', (double)frameCount / (now1 - lastCheckTime));
            SDL_SetWindowTitle(window, title);
            frameCount = 0;

            lastCheckTime = now1;
            struct stat st;
            stat(srcFile, &st);
            if (lastMtime != st.st_mtime)
            {
                printf("[CHANGE] \"%s\" [%s]\n", srcFile, nowStr(timeBuf));
                sceneTime = 0;
                loadSceneByFile(srcFile);
            }
            lastMtime = st.st_mtime;
        }



        f32 now = (f32)SDL_GetTicks() / 1000.f;
        f32 deltaTime = lazyMode ? 0 : now1 - now;
        now1 = now;
        if (!lazyMode || outdated)
        {
            outdated = false;
            ++frameCount;
            sceneTime += deltaTime;
            SCREEN_frame(sceneTime);
        }
        SDL_GL_SwapWindow(window);
        // SDL_Delay(1);
    }


    SCREEN_destroy();
    SDL_GL_DeleteContext(context);
    SDL_DestroyWindow(window);
    SDL_Quit();

    return mainReturn(EXIT_SUCCESS);
}




































































































