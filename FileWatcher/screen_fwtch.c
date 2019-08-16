#include "screen_fwtch.h"
#include "screen_sceneloader_file.h"
#include "screen_configloader_file.h"
#include "screen_a.h"

#include <sys/stat.h>






typedef struct SCREEN_FwtchFile
{
    char path[SCREEN_PATH_BUF_MAX];
    time_t mtimeLast;
} SCREEN_FwtchFile;

typedef vec_t(SCREEN_FwtchFile) SCREEN_FwtchFileVec;




typedef struct SCREEN_FwtchContext
{
    bool hasSceneFile;
    bool hasConfigFile;
    SCREEN_FwtchFileVec sceneFiles[1];
    SCREEN_FwtchFile configFile[1];
    vec_char pathBuf[1];
    u32 sceneFileIndex;
} SCREEN_FwtchContext;

static SCREEN_FwtchContext* ctx = NULL;





void SCREEN_fwtchStartup(void)
{
    assert(!ctx);
    ctx = zalloc(sizeof(SCREEN_FwtchContext));
}

void SCREEN_fwtchDestroy(void)
{
    vec_free(ctx->pathBuf);
    vec_free(ctx->sceneFiles);
    free(ctx);
    ctx = NULL;
}









static void SCREEN_fwtchFileInit(SCREEN_FwtchFile* wf, const char* path)
{
    stzncpy(wf->path, path, SCREEN_PATH_BUF_MAX);
    struct stat st;
    stat(wf->path, &st);
    wf->mtimeLast = st.st_mtime;
}

static bool SCREEN_fwtchFileCheckModify(SCREEN_FwtchFile* wf)
{
    struct stat st;
    stat(wf->path, &st);
    if (wf->mtimeLast != st.st_mtime)
    {
        wf->mtimeLast = st.st_mtime;
        return true;
    }
    else
    {
        return false;
    }
}







SCREEN_LoadFileError SCREEN_fwtchScreenBind(const char* filename)
{
    assert(ctx);
    vec_char* pathBuf = ctx->pathBuf;
    vec_resize(pathBuf, 0);

    SCREEN_LoadFileError err = SCREEN_loadSceneFile(filename, pathBuf);
    if (err)
    {
        return err;
    }

    if (ctx->hasSceneFile)
    {
        SCREEN_fwtchScreenUnbind();
    }
    ctx->hasSceneFile = true;

    SCREEN_FwtchFileVec* sceneFiles = ctx->sceneFiles;
    assert(0 == sceneFiles->length);

    for (u32 off = 0; off < pathBuf->length;)
    {
        vec_resize(sceneFiles, sceneFiles->length + 1);
        SCREEN_FwtchFile* wf = &vec_last(sceneFiles);
        SCREEN_fwtchFileInit(wf, pathBuf->data + off);
        off += (u32)strlen(pathBuf->data + off) + 1;
        assert(off <= pathBuf->length);
    }
    return SCREEN_LoadFileError_NONE;
}







SCREEN_LoadFileError SCREEN_fwtchConfigBind(const char* filename)
{
    assert(ctx);
    SCREEN_LoadFileError err = SCREEN_loadConfigFile(filename);
    if (err)
    {
        return err;
    }

    if (ctx->hasConfigFile)
    {
        SCREEN_fwtchConfigUnbind();
    }
    ctx->hasConfigFile = true;

    SCREEN_FwtchFile* configFile = ctx->configFile;
    SCREEN_fwtchFileInit(configFile, filename);
    return SCREEN_LoadFileError_NONE;
}







void SCREEN_fwtchScreenUnbind(void)
{
    if (!ctx->hasSceneFile)
    {
        return;
    }
    ctx->hasSceneFile = false;
    vec_resize(ctx->sceneFiles, 0);
}






void SCREEN_fwtchConfigUnbind(void)
{
    if (!ctx->hasConfigFile)
    {
        return;
    }
    ctx->hasConfigFile = false;
}










bool SCREEN_fwtchUpdate(void)
{
    assert(ctx);
    bool modified = false;
    if (ctx->hasSceneFile)
    {
        SCREEN_FwtchFileVec* sceneFiles = ctx->sceneFiles;
        vec_char* pathBuf = ctx->pathBuf;
        vec_resize(pathBuf, 0);

        bool m = SCREEN_fwtchFileCheckModify(sceneFiles->data + ctx->sceneFileIndex);
        modified = modified || m;
        if (m)
        {
            LOGD("[SCENE CHANGE] \"%s\"", sceneFiles->data[ctx->sceneFileIndex].path);
            SCREEN_LoadFileError err = SCREEN_loadSceneFile(sceneFiles->data[0].path, pathBuf);
            if (!err)
            {
                vec_resize(sceneFiles, 0);
                for (u32 off = 0; off < pathBuf->length;)
                {
                    vec_resize(sceneFiles, sceneFiles->length + 1);
                    SCREEN_FwtchFile* wf = &vec_last(sceneFiles);
                    SCREEN_fwtchFileInit(wf, pathBuf->data + off);
                    off += (u32)strlen(pathBuf->data + off) + 1;
                    assert(off <= pathBuf->length);
                }
            }
        }
        ctx->sceneFileIndex = (ctx->sceneFileIndex + 1) % sceneFiles->length;
    }
    if (ctx->hasConfigFile)
    {
        SCREEN_FwtchFile* configFile = ctx->configFile;
        bool m = SCREEN_fwtchFileCheckModify(configFile);
        modified = modified || m;
        if (m)
        {
            LOGD("[CONFIG CHANGE] \"%s\"", configFile->path);
            SCREEN_LoadFileError err = SCREEN_loadConfigFile(configFile->path);
            if (!err)
            {
                SCREEN_fwtchFileInit(configFile, configFile->path);
            }
        }
    }
    return modified;
}





































































































