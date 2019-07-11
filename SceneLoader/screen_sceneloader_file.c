#include "screen_sceneloader_file.h"
#include "screen_a.h"

#include <fileu.h>
#include <vec.h>
#include <nxjson.h>

#include <stb_image.h>





static void SCREEN_pathAdd(const char* filename, vec_char* pathBuf)
{
    if (pathBuf)
    {
        vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
    }
}



static u32 SCREEN_loadFileDataToBuf(vec_char* dataBuf, const char* filename, vec_char* pathBuf)
{
    u32 size = FILEU_readFile(filename, NULL, 0);
    if ((-1 == size) || !size)
    {
        // todo report error
        return -1;
    }
    u32 offset = dataBuf->length;
    vec_resize(dataBuf, offset + size + 1);
    size = FILEU_readFile(filename, dataBuf->data + offset, size);
    dataBuf->data[offset + size] = 0;
    SCREEN_pathAdd(filename, pathBuf);
    return offset;
}












static void SCREEN_loadSceneAssetFromJson
(
    const nx_json* assetJs, const char* dir,
    SCREEN_Scene* desc, vec_char* dataBuf,
    u32* pDataOff, u32 ai,
    vec_char* pathBuf
)
{
    char path[SCREEN_PATH_MAX] = "";
    if (assetJs->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }

    SCREEN_AssetType type = -1;
    {
        const nx_json* typeJs = nx_json_get(assetJs, "type");
        if (typeJs->type != NX_JSON_STRING)
        {
            // todo report error
            goto error;
        }
        const char* typeStr = typeJs->text_value;
        for (u32 i = 0; i < SCREEN_AssetTypeCount; ++i)
        {
            if (strcicmp(typeStr, SCREEN_AssetTypeNameTable(i)) == 0)
            {
                desc->asset[ai].type = i;
                type = i;
                break;
            }
        }
        if (-1 == type)
        {
            // todo report error
            goto error;
        }
    }

    {
        const nx_json* uriJs = nx_json_get(assetJs, "uri");
        if (uriJs->type != NX_JSON_STRING)
        {
            // todo report error
            goto error;
        }
        const char* filename = uriJs->text_value;
        snprintf(path, sizeof(path), "%s/%s", dir, filename);

        if (SCREEN_AssetType_2D == type)
        {
            int x, y, comp;
            int r = stbi_info(path, &x, &y, &comp);
            if (!r)
            {
                // todo report error
                goto error;
            }
            desc->asset[ai].components = comp;
            desc->asset[ai].dataType = SCREEN_DataType_U8;
            desc->asset[ai].size[0] = x;
            desc->asset[ai].size[1] = y;
            desc->asset[ai].size[2] = 1;
            stbi_uc* data = stbi_load(path, &x, &y, &comp, comp);
            if (!data)
            {
                // todo report error
                goto error;
            }
            u32 dataSize = x * y * comp;

            u32 dataOff = dataBuf->length;
            vec_resize(dataBuf, dataOff + dataSize);
            memcpy(dataBuf->data + dataOff, data, dataSize);
            SCREEN_pathAdd(filename, pathBuf);
            *pDataOff = dataOff;
        }
        else
        {
            // todo report error
            goto error;
        }
    }
    return;
error:
    *pDataOff = -1;
}









static void SCREEN_loadScenePassFromJson
(
    const nx_json* passJs, const char* dir,
    SCREEN_Scene* desc, vec_char* dataBuf,
    u32* pShaderOff, u32* pBi,
    vec_char* pathBuf
)
{
    char path[SCREEN_PATH_MAX] = "";
    if (passJs->type != NX_JSON_OBJECT)
    {
        // todo report error
        goto error;
    }
    const nx_json* shaderJs = nx_json_get(passJs, "shader");
    if (shaderJs->type != NX_JSON_STRING)
    {
        // todo report error
        goto error;
    }
    const char* filename = shaderJs->text_value;
    snprintf(path, sizeof(path), "%s/%s", dir, filename);
    u32 shaderOff = SCREEN_loadFileDataToBuf(dataBuf, path, pathBuf);
    if (-1 == shaderOff)
    {
        // todo report error
        goto error;
    }

    u32 bi = -1;
    if (pBi)
    {
        const nx_json* idJs = nx_json_get(passJs, "id");
        if (idJs->type != NX_JSON_INTEGER)
        {
            // todo report error
            goto error;
        }
        bi = (int)idJs->int_value;
        if (bi >= SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
    }

    SCREEN_RenderPass* renderPass;
    if (pBi)
    {
        renderPass = desc->buffer2d + bi;
    }
    else
    {
        renderPass = &desc->image;
    }

    const nx_json* channelsJs = nx_json_get(passJs, "channels");
    if (channelsJs->type != NX_JSON_NULL)
    {
        if (channelsJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        if (channelsJs->length > SCREEN_Channels_MAX)
        {
            // todo report error
            goto error;
        }
        for (int ci = 0; ci < channelsJs->length; ++ci)
        {
            const nx_json* channelJs = nx_json_item(channelsJs, ci);
            u32 cidx = ci;
            if ((channelJs->type != NX_JSON_ARRAY) && (channelJs->type != NX_JSON_NULL))
            {
                // todo report error
                goto error;
            }
            if (NX_JSON_NULL == channelJs->type)
            {
                continue;
            }
            if (!channelJs->length)
            {
                // todo report error
                goto error;
            }
            const nx_json* typeJs = nx_json_item(channelJs, 0);
            if (typeJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* typeText = typeJs->text_value;
            if (0 == strcicmp(typeText, "pass"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Buffer2D;
                const nx_json* idJs = nx_json_item(channelJs, 1);
                if (idJs->type != NX_JSON_INTEGER)
                {
                    // todo report error
                    goto error;
                }
                renderPass->channel[cidx].buffer2d = (u32)idJs->int_value;
            }
            else if (0 == strcicmp(typeText, "keyboard"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Keyboard;
            }
            else if (0 == strcicmp(typeText, "asset"))
            {
                renderPass->channel[cidx].type = SCREEN_ChannelType_Asset;
                const nx_json* idJs = nx_json_item(channelJs, 1);
                if (idJs->type != NX_JSON_INTEGER)
                {
                    // todo report error
                    goto error;
                }
                renderPass->channel[cidx].buffer2d = (u32)idJs->int_value;
            }
            else
            {
                // todo report error
                continue;
            }
        }
    }
    *pShaderOff = shaderOff;
    if (pBi)
    {
        *pBi = bi;
    }
    return;
error:
    *pShaderOff = -1;
    *pBi = -1;
}







static SCREEN_LoadFileError SCREEN_loadSceneFromJson(char* code, const char* dir, SCREEN_Scene* desc, vec_char* pathBuf)
{
    vec_char dataBuf[1] = { 0 };
    char path[SCREEN_PATH_MAX] = "";
    u32 assetDataOff[SCREEN_Assets_MAX] = { 0 };
    u32 commShaderOff = -1, imageShaderOff = -1;
    bool bufferUsed[SCREEN_Buffer2Ds_MAX] = { 0 };
    u32 bufferShaderOff[SCREEN_Buffer2Ds_MAX] = { 0 };

    const nx_json* rootJs = nx_json_parse(code, NULL);
    if (!rootJs)
    {
        // todo report error
        return SCREEN_LoadFileError_FileInvalid;
    }
    const nx_json* assetsJs = nx_json_get(rootJs, "assets");
    if (assetsJs->type != NX_JSON_NULL)
    {
        if (assetsJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        desc->assetCount = assetsJs->length;
        for (int ai = 0; ai < assetsJs->length; ++ai)
        {
            const nx_json* assetJs = nx_json_item(assetsJs, ai);
            u32 dataOff;
            SCREEN_loadSceneAssetFromJson(assetJs, dir, desc, dataBuf, &dataOff, ai, pathBuf);
            if (dataOff != -1)
            {
                assetDataOff[ai] = dataOff;
            }
            else
            {
                // todo report error
                goto error;
            }
        }
    }
    {
        const nx_json* shaderJs = nx_json_get(rootJs, "commonShader");
        if (shaderJs->type != NX_JSON_NULL)
        {
            if (shaderJs->type != NX_JSON_STRING)
            {
                // todo report error
                goto error;
            }
            const char* filename = shaderJs->text_value;
            snprintf(path, sizeof(path), "%s/%s", dir, filename);
            u32 shaderOff = SCREEN_loadFileDataToBuf(dataBuf, path, pathBuf);
            if (-1 == shaderOff)
            {
                // todo report error
                goto error;
            }
            commShaderOff = shaderOff;
        }
    }
    const nx_json* buffersJs = nx_json_get(rootJs, "buffers");
    if (buffersJs->type != NX_JSON_NULL)
    {
        if (buffersJs->type != NX_JSON_ARRAY)
        {
            // todo report error
            goto error;
        }
        for (int i = 0; i < buffersJs->length; ++i)
        {
            const nx_json* bufferJs = nx_json_item(buffersJs, i);
            u32 shaderOff, bi;
            SCREEN_loadScenePassFromJson(bufferJs, dir, desc, dataBuf, &shaderOff, &bi, pathBuf);
            if (shaderOff != -1)
            {
                assert(bi != -1);
                bufferShaderOff[bi] = shaderOff;
                bufferUsed[bi] = true;
            }
            else
            {
                // todo report error
                goto error;
            }
        }
    }

    const nx_json* imageJs = nx_json_get(rootJs, "image");
    SCREEN_loadScenePassFromJson(imageJs, dir, desc, dataBuf, &imageShaderOff, NULL, pathBuf);

    for (u32 i = 0; i < desc->assetCount; ++i)
    {
        desc->asset[i].data = dataBuf->data + assetDataOff[i];
    }
    if (commShaderOff != -1)
    {
        desc->shaderCommon = dataBuf->data + commShaderOff;
    }
    for (u32 i = 0; i < SCREEN_Buffer2Ds_MAX; ++i)
    {
        if (bufferUsed[i])
        {
            desc->buffer2d[i].shaderCode = dataBuf->data + bufferShaderOff[i];
        }
    }
    desc->image.shaderCode = dataBuf->data + imageShaderOff;

    SCREEN_loadScene(desc);

    vec_free(dataBuf);
    nx_json_free(rootJs);
    return SCREEN_LoadFileError_NONE;
error:
    vec_free(dataBuf);
    nx_json_free(rootJs);
    return SCREEN_LoadFileError_FileInvalid;
}









SCREEN_LoadFileError SCREEN_loadSceneFile(const char* filename, vec_char* pathBuf)
{
    SCREEN_Scene desc[1] = { 0 };
    if (FILEU_fileExist(filename))
    {
        if (FILEU_dirExist(filename))
        {
            char path[SCREEN_PATH_MAX] = "";
            snprintf(path, sizeof(path), "%s/%s", filename, "index.json");

            if (FILEU_fileExist(path))
            {
                u32 size = FILEU_readFile(path, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(path, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, path, 1 + (u32)strlen(path));
                }

                char dir[SCREEN_PATH_MAX];
                FILEU_getDirName(dir, path, sizeof(dir));
                SCREEN_LoadFileError r = SCREEN_loadSceneFromJson(buf, dir, desc, pathBuf);
                free(buf);
                return r;
            }
            else
            {
                // todo report error
                return SCREEN_LoadFileError_NoEntryFile;
            }
        }
        else
        {
            if ((0 == strcicmp(FILEU_filenameExt(filename), "frag")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "glsl")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fs")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fsh")) ||
                (0 == strcicmp(FILEU_filenameExt(filename), "fshader")))
            {
                u32 size = FILEU_readFile(filename, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(filename, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
                }

                desc->image.shaderCode = buf;
                bool r = SCREEN_loadScene(desc);
                free(buf);
                return r ? SCREEN_LoadFileError_NONE : SCREEN_LoadFileError_FileInvalid;
            }
            else if (0 == strcicmp(FILEU_filenameExt(filename), "json"))
            {
                u32 size = FILEU_readFile(filename, NULL, 0);
                if ((-1 == size) || !size)
                {
                    // todo report error
                    return SCREEN_LoadFileError_FileInvalid;
                }
                char* buf = malloc(size + 1);
                size = FILEU_readFile(filename, buf, size);
                buf[size] = 0;

                if (pathBuf)
                {
                    vec_pusharr(pathBuf, filename, 1 + (u32)strlen(filename));
                }

                char dir[SCREEN_PATH_MAX];
                FILEU_getDirName(dir, filename, sizeof(dir));
                SCREEN_LoadFileError r = SCREEN_loadSceneFromJson(buf, dir, desc, pathBuf);
                free(buf);
                return r;
            }
            else
            {
                // todo report error
                return SCREEN_LoadFileError_FileUnkExt;
            }
        }
    }
    else
    {
        // todo report error
        return SCREEN_LoadFileError_NoFile;
    }
}































































































